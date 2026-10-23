using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CatEcommerce.Domain.Aggregates.Billing;
using CatEcommerce.Domain.DomainServices;
using CatEcommerce.Domain.Models;
using CatEcommerce.Domain.ValueObjects;
using CatEcommerce.Infrastructure.Persistence;
using CatEcommerce.Shared.Common.Constants;
using CatEcommerce.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>HO-BIL-001 §16 group B (I-B3…I-B5, U-B3) -- manual charges and voids; the push port is idempotent by
/// source key (ADR-178).</summary>
public sealed class BillingChargeEndpointTests(BillingApiFactory factory) : BillingIntegrationTestBase(factory)
{
    private async Task<JsonElement> ChargesOfAsync(BillingContext context, Guid customerId, string? status = null)
    {
        var url = $"/api/staff/billing/charges?customerId={customerId}" + (status is null ? "" : $"&status={status}");
        var page = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await context.Admin.GetAsync(url)));
        return page.GetProperty("items");
    }

    /// <summary>I-B3 -- a manual charge is a free-text fee, recorded as entered.</summary>
    [Fact]
    public async Task I_B3_AManualCharge_IsAFreeTextFee_AsEntered()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);

        var fee = await ExpectAsync(HttpStatusCode.Created, await context.Admin.PostAsJsonAsync("/api/staff/billing/charges", new
        {
            customerId, description = "Late pickup fee", unitPrice = 125.50m, taxClassId = context.ZeroTaxClassId, quantity = 1, lineDiscount = 5.50m,
            serviceDate = Today.ToString("yyyy-MM-dd"), businessLine = "Shop",
        }, Json));
        var feeChargeId = (await ReadAsync(fee)).GetProperty("chargeId").GetGuid();

        var charges = (await ChargesOfAsync(context, customerId)).EnumerateArray().ToList();
        var byFee = charges.Single(c => c.GetProperty("chargeId").GetGuid() == feeChargeId);
        Assert.Equal("Late pickup fee", byFee.GetProperty("description").GetString());
        Assert.Equal("125.50", byFee.GetProperty("unitPrice").GetProperty("amount").GetString());
        Assert.Equal("120.00", byFee.GetProperty("lineTotal").GetProperty("amount").GetString());
        Assert.Equal("Fee", byFee.GetProperty("itemKind").GetString());
        Assert.Equal("Manual", byFee.GetProperty("sourceKind").GetString());
        Assert.Equal("Shop", byFee.GetProperty("businessLine").GetString());
    }

    [Fact]
    public async Task AManualCharge_ForAnUnknownCustomer_OrABadShape_Is400()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var date = Today.ToString("yyyy-MM-dd");

        Assert.Equal(HttpStatusCode.BadRequest, (await context.Admin.PostAsJsonAsync("/api/staff/billing/charges",
            new { customerId = Guid.NewGuid(), description = "x", unitPrice = 1, taxClassId = context.TaxClassId, quantity = 1, serviceDate = date }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await context.Admin.PostAsJsonAsync("/api/staff/billing/charges",
            new { customerId, description = "x", unitPrice = 1.005m, taxClassId = context.TaxClassId, quantity = 1, serviceDate = date }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await context.Admin.PostAsJsonAsync("/api/staff/billing/charges",
            new { customerId, description = "x", unitPrice = 1, taxClassId = Guid.NewGuid(), quantity = 1, serviceDate = date }, Json)).StatusCode);
    }

    /// <summary>I-B4 (first half) -- an unbilled charge is voided with a reason; voiding twice is refused.</summary>
    [Fact]
    public async Task I_B4_AnUnbilledCharge_IsVoided_WithAReason_ThenItLeavesTheUnbilledList()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var chargeId = await RecordChargeAsync(context, customerId);

        Assert.Equal(HttpStatusCode.BadRequest, (await context.Admin.PostAsJsonAsync($"/api/staff/billing/charges/{chargeId}/void", new { reason = "" }, Json)).StatusCode);
        await ExpectAsync(HttpStatusCode.NoContent, await context.Admin.PostAsJsonAsync($"/api/staff/billing/charges/{chargeId}/void", new { reason = "Entered twice" }, Json));
        Assert.Equal(HttpStatusCode.BadRequest, (await context.Admin.PostAsJsonAsync($"/api/staff/billing/charges/{chargeId}/void", new { reason = "Again" }, Json)).StatusCode);

        Assert.Empty((await ChargesOfAsync(context, customerId, "unbilled")).EnumerateArray());
        var voided = Assert.Single((await ChargesOfAsync(context, customerId, "voided")).EnumerateArray());
        Assert.Equal("Entered twice", voided.GetProperty("voidReason").GetString());
    }

    /// <summary>U-B3 -- the recorder returns the existing id for a source key already tracked in the context, and
    /// for one already in the table; nothing extra is added.</summary>
    [Fact]
    public async Task U_B3_TheRecorder_IsIdempotentBySourceKey_TrackedAndPersisted()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var sourceId = Guid.NewGuid();
        var request = new ChargeRequestDto(
            customerId, context.BranchId, BusinessLine.Shop, ItemKind.Product, ChargeSourceKind.Order, sourceId, "line-1",
            "Mustard oil 1 L", 2m, new Money(450m, "BDT"), new Money(0m, "BDT"), context.TaxClassId, Today);

        Guid first, second;
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var recorder = scope.ServiceProvider.GetRequiredService<IBillableChargeRecorder>();
            first = await recorder.RecordAsync(request);
            second = await recorder.RecordAsync(request with { Description = "different text, same key" });
            Assert.Equal(first, second);
            await scope.ServiceProvider.GetRequiredService<CatEcommerceDbContext>().SaveChangesAsync();
        }

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var recorder = scope.ServiceProvider.GetRequiredService<IBillableChargeRecorder>();
            var third = await recorder.RecordAsync(request);
            Assert.Equal(first, third);
            await scope.ServiceProvider.GetRequiredService<CatEcommerceDbContext>().SaveChangesAsync();
        }

        Assert.Equal(1, await CountAsync<ChargeAggregate>(c => c.SourceId == sourceId));
    }

    /// <summary>The port validates, never reprices: a bad quantity or a foreign currency is a domain violation.</summary>
    [Fact]
    public async Task TheRecorder_ValidatesTheRequest_ItNeverReprices()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var bad = new ChargeRequestDto(
            customerId, context.BranchId, BusinessLine.Shop, ItemKind.Product, ChargeSourceKind.Order, Guid.NewGuid(), "main",
            "x", 1m, new Money(10m, "USD"), new Money(0m, "USD"), context.TaxClassId, Today);

        await using var scope = Factory.Services.CreateAsyncScope();
        var recorder = scope.ServiceProvider.GetRequiredService<IBillableChargeRecorder>();

        var ex = await Assert.ThrowsAsync<CatEcommerce.Domain.Exceptions.DomainRuleViolationException>(() => recorder.RecordAsync(bad));
        Assert.Equal(BusinessViolationCodes.CurrencyMismatch, ex.ErrorCode);
        await Assert.ThrowsAsync<CatEcommerce.Domain.Exceptions.DomainRuleViolationException>(() => recorder.RecordAsync(bad with { UnitPrice = new Money(10m, "BDT"), LineDiscount = new Money(0m, "BDT"), Quantity = 0m }));
    }

    /// <summary>The recorder's void: absent is a no-op; an unbilled charge is voided in the caller's unit of work.</summary>
    [Fact]
    public async Task TheRecorderVoid_AbsentIsANoOp_AndAnUnbilledChargeIsVoidedInTheCallersUnitOfWork()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var sourceId = Guid.NewGuid();
        await RecordChargeAsync(context, customerId, sourceId: sourceId, sourceLineRef: "line-1");

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var recorder = scope.ServiceProvider.GetRequiredService<IBillableChargeRecorder>();
            await recorder.VoidAsync(new ChargeSourceKey(ChargeSourceKind.Order, Guid.NewGuid(), "line-1"), "nothing there");
            await recorder.VoidAsync(new ChargeSourceKey(ChargeSourceKind.Order, sourceId, "line-1"), "Line cancelled");
            await scope.ServiceProvider.GetRequiredService<CatEcommerceDbContext>().SaveChangesAsync();
        }

        var charge = await WithDbAsync(db => db.Charges.AsNoTracking().SingleAsync(c => c.SourceId == sourceId));
        Assert.Equal(ChargeStatus.Voided, charge.Status);
        Assert.Equal("Line cancelled", charge.VoidReason);
    }

    /// <summary>I-B5 -- two requests record the same source key concurrently: never two rows. The loser is either
    /// deduplicated by the pre-check or surfaces the unique index (<c>409 ChargeAlreadyRecorded</c> at the edge).</summary>
    [Fact]
    public async Task I_B5_TheSameSourceKeyRecordedConcurrently_NeverMakesTwoRows()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var sourceId = Guid.NewGuid();

        async Task<(bool Saved, bool UniqueViolation)> TryRecord()
        {
            try
            {
                await RecordChargeAsync(context, customerId, sourceId: sourceId, sourceLineRef: "line-1");
                return (true, false);
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { ConstraintName: "ix_charge_source" })
            {
                return (false, true);
            }
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(TryRecord)));

        Assert.Contains(results, r => r.Saved);
        Assert.Equal(1, await CountAsync<ChargeAggregate>(c => c.SourceId == sourceId));
    }

    [Fact]
    public async Task TheRaceOnTheSourceKey_SurfacesAs409ChargeAlreadyRecorded_NotAn500()
    {
        // The filter mapping is exercised directly in UniqueConstraintExceptionFilterTests; here the unique index
        // itself is proven to be the guard when the pre-check cannot see a concurrent insert.
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        var sourceId = Guid.NewGuid();
        var chargeId = await RecordChargeAsync(context, customerId, sourceId: sourceId);

        var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
            await WithDbAsync(async db =>
            {
                var duplicate = new ChargeAggregate(Guid.NewGuid());
                duplicate.Record(new ChargeRequestDto(
                    customerId, context.BranchId, BusinessLine.Shop, ItemKind.Product, ChargeSourceKind.Order, sourceId, "main",
                    "dup", 1m, new Money(1m, "BDT"), new Money(0m, "BDT"), context.TaxClassId, Today),
                    new ChargeRecordContext("BDT", Now, new BillingActor(new Platform.Infrastructure.Common.Security.UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid())));
                db.Charges.Add(duplicate);
                await db.SaveChangesAsync();
                return 0;
            }));

        Assert.Equal("ix_charge_source", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).ConstraintName);
        Assert.NotEqual(Guid.Empty, chargeId);
    }

    [Fact]
    public async Task ChargesOfAnotherBranch_AreNotVisible_AndNotVoidable()
    {
        var mine = await CreateBillingContextAsync();
        var other = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(mine);
        var chargeId = await RecordChargeAsync(mine, customerId);

        Assert.Empty((await ChargesOfAsync(other, customerId)).EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await other.Admin.PostAsJsonAsync($"/api/staff/billing/charges/{chargeId}/void", new { reason = "not mine" }, Json)).StatusCode);
        Assert.Single((await ChargesOfAsync(mine, customerId)).EnumerateArray());
    }

    [Fact]
    public async Task ChargeEndpoints_AreRestrictedToBillingStaff()
    {
        var context = await CreateBillingContextAsync();
        var (inventory, _) = await StaffClientAsync(context, StaffRoles.Inventory);
        var (reception, _) = await StaffClientAsync(context, StaffRoles.Reception);

        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.GetAsync("/api/staff/billing/charges")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.PostAsJsonAsync("/api/staff/billing/charges", new { }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await reception.GetAsync("/api/staff/billing/charges")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient().GetAsync("/api/staff/billing/charges")).StatusCode);
    }
}
