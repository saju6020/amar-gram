using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-SUB-001 section 16 H and X (ADR-247, ADR-248, ADR-238) -- the staff reads and who may use them, the lifecycle reactions to a customer merge and an account deletion, the
/// CSV-injection guard on the export, and what never reaches a response or a log (a payment token, a cancellation note, a reinstatement reason). Real HTTP, real Orders behind it.
/// </summary>
public sealed class SubscriptionsStaffAndLifecycleEndpointTests(OrderingApiFactory factory) : SubscriptionsIntegrationTestBase(factory)
{
    // ── ADR-248: who may do what ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_F7_TheStaffRoutes_FollowTheInferredMatrix_AGuestAndACustomerAreTurnedAway()
    {
        var shop = await SetUpSubscribableShopAsync();
        var id = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();
        var reception = (await StaffClientAsync(shop.Context, StaffRoles.Reception)).Client;
        var guest = CreateClient();

        string[] reads = ["/api/staff/subscriptions", "/api/staff/subscriptions/unpaid", "/api/staff/subscriptions/due-tomorrow", $"/api/staff/subscriptions/{id}",
            $"/api/staff/subscriptions/{id}/cycles", $"/api/staff/customers/{shop.CustomerId}/subscriptions"];

        foreach (var url in reads)
        {
            Assert.Equal(HttpStatusCode.OK, (await reception.GetAsync(url)).StatusCode);                    // Subscriptions.View: Reception reads
            Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync(url)).StatusCode);
            Assert.Contains((await shop.Customer.GetAsync(url)).StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });   // a customer session is not staff
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await reception.GetAsync("/api/staff/subscriptions/export.csv")).StatusCode);                                      // Export: not Reception
        Assert.Equal(HttpStatusCode.Forbidden, (await reception.PostAsJsonAsync($"/api/staff/subscriptions/{id}/cancel", new { note = "x" }, Json)).StatusCode);   // Manage: not Reception
        Assert.Equal(HttpStatusCode.Forbidden, (await reception.PostAsJsonAsync($"/api/staff/subscriptions/{id}/reinstate", new { reason = "x" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await shop.Context.Admin.GetAsync($"/api/staff/subscriptions/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await shop.Context.Admin.GetAsync("/api/staff/subscriptions/export.csv")).StatusCode);
    }

    [Fact]
    public async Task AStaffCancellation_NeedsANote_StoresItForStaffOnly_AndTellsTheCustomer()
    {
        var shop = await SetUpSubscribableShopAsync();
        var id = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();
        var admin = shop.Context.Admin;

        await RefusedAsync(await admin.PostAsJsonAsync($"/api/staff/subscriptions/{id}/cancel", new { note = " " }, Json), BusinessViolationCodes.CancellationReasonRequired);

        var cancelled = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.PostAsJsonAsync($"/api/staff/subscriptions/{id}/cancel", new { note = "Customer rang to stop" }, Json)));
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());

        var staffDetail = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync($"/api/staff/subscriptions/{id}")));
        Assert.Equal("StaffCancelled", staffDetail.GetProperty("cancellationReason").GetString());
        Assert.Equal("Customer rang to stop", staffDetail.GetProperty("cancellationNote").GetString());
        Assert.Equal(shop.CustomerId, staffDetail.GetProperty("customer").GetProperty("id").GetGuid());
        Assert.False(string.IsNullOrWhiteSpace(staffDetail.GetProperty("customer").GetProperty("name").GetString()));

        var customerView = await BodyAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/subscriptions/{id}")));
        Assert.DoesNotContain("Customer rang to stop", customerView);   // the note is staff's
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCancelled));
    }

    [Fact]
    public async Task TheStaffViews_ListFilterAndSummariseSubscriptions()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var admin = shop.Context.Admin;

        var page = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync("/api/staff/subscriptions?status=Active&paymentMethod=CashOnDelivery&pageSize=100")));
        Assert.All(page.GetProperty("items").EnumerateArray(), i => Assert.Equal("Active", i.GetProperty("status").GetString()));
        Assert.Equal(400, (int)(await admin.GetAsync("/api/staff/subscriptions?status=Nonsense")).StatusCode);

        var panel = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync($"/api/staff/customers/{shop.CustomerId}/subscriptions")));
        Assert.Equal(id, Assert.Single(panel.GetProperty("live").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(0, panel.GetProperty("cancelledCount").GetInt32());

        var detail = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync($"/api/staff/subscriptions/{id}")));
        Assert.Equal(["Cancel"], detail.GetProperty("allowedStaffActions").EnumerateArray().Select(a => a.GetString()));
        Assert.Equal(0, detail.GetProperty("cycles").GetArrayLength());
    }

    [Fact]
    public async Task TheDashboardCount_OfSubscriptionOrdersDueTomorrow_IncludesASubscriptionDueTomorrow()
    {
        var shop = await SetUpSubscribableShopAsync();
        var due = Today.AddDays(5);
        await SubscribeAsync(shop, first: due);
        AdvanceToLocal(due.AddDays(-1));

        var admin = await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId);
        var tile = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync("/api/staff/subscriptions/due-tomorrow")));

        Assert.Equal(due, DateOf(tile, "dueOn"));
        Assert.True(tile.GetProperty("count").GetInt32() >= 1);
        Assert.True(tile.GetProperty("liveCount").GetInt32() >= tile.GetProperty("count").GetInt32());
        Assert.Equal("Asia/Dhaka", tile.GetProperty("commerceTimeZoneId").GetString());
    }

    // ── I-X3: the CSV export ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_X3_TheExport_NeutralisesAFormulaInAProductName()
    {
        var shop = await SetUpSubscribableShopAsync(foodName: "=HYPERLINK(\"http://evil.example\",\"x\")");
        var id = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();

        var response = await ExpectAsync(HttpStatusCode.OK, await shop.Context.Admin.GetAsync("/api/staff/subscriptions/export.csv"));
        Assert.StartsWith("text/csv", response.Content.Headers.ContentType!.MediaType + "");
        var csv = await BodyAsync(response);

        var line = csv.Split("\r\n").Single(l => l.Contains(id.ToString()));
        Assert.Contains("\"'=HYPERLINK(", line);
        Assert.DoesNotContain(",\"=HYPERLINK", line);
        Assert.StartsWith("\"SubscriptionId\"", csv);
    }

    // ── I-X2 / I-X1: nothing payment-shaped or private leaves the process ────────────────────────

    private static readonly Regex PaymentToken = new(@"card|token|\bpan\b|cvv|mandate|gateway|autoCharge", RegexOptions.IgnoreCase);

    private static IEnumerable<string> PropertyNames(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
            foreach (var property in element.EnumerateObject())
            {
                yield return property.Name;
                foreach (var nested in PropertyNames(property.Value)) yield return nested;
            }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (var item in element.EnumerateArray())
                foreach (var nested in PropertyNames(item)) yield return nested;
    }

    [Fact]
    public async Task I_X2_NoSubscriptionResponse_CarriesAPaymentTokenCardOrGatewayField()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var changed = await ReadAsync(await PostAsync(shop.Customer, id, "pause"));
        var admin = shop.Context.Admin;

        var bodies = new List<JsonElement>
        {
            view, changed,
            await ReadAsync(await shop.Customer.GetAsync($"/api/customers/me/subscriptions/options?skuId={shop.Food.SkuId}")),
            await ReadAsync(await shop.Customer.GetAsync($"/api/customers/me/subscriptions/payment-methods?skuId={shop.Food.SkuId}&quantity=1&deliveryAddressId={shop.AddressId}")),
            await ReadAsync(await shop.Customer.GetAsync("/api/customers/me/subscriptions")),
            await ReadAsync(await shop.Customer.GetAsync($"/api/customers/me/subscriptions/{id}")),
            await ReadAsync(await admin.GetAsync($"/api/staff/subscriptions/{id}")),
            await ReadAsync(await admin.GetAsync("/api/staff/subscriptions?pageSize=100")),
            await ReadAsync(await admin.GetAsync($"/api/staff/customers/{shop.CustomerId}/subscriptions")),
        };

        var offenders = bodies.SelectMany(PropertyNames).Where(n => PaymentToken.IsMatch(n)).Distinct().ToList();
        Assert.True(offenders.Count == 0, "Payment-shaped fields: " + string.Join(", ", offenders));
    }

    [Fact]
    public async Task I_X1_TheLogs_NeverCarryACancellationNote_OrAReinstatementReason()
    {
        var shop = await SetUpSubscribableShopAsync();
        var (logged, logs) = Factory.WithCapturedLogs();
        var customer = await SignInOnAsync(logged, shop.CustomerId);
        var note = "PrivateNote-" + Guid.NewGuid().ToString("N");
        var reason = "PrivateReason-" + Guid.NewGuid().ToString("N");

        var view = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await customer.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food), Json)));
        var id = view.GetProperty("id").GetGuid();
        await ExpectAsync(HttpStatusCode.OK, await PostAsync(customer, id, "pause"));
        await ExpectAsync(HttpStatusCode.OK, await PostAsync(customer, id, "cancel", new { reason = "Other", note }));

        // A second subscription is suspended by staff-visible means and reinstated with a reason: drive it through the aggregate so only the log capture is under test here.
        var other = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await customer.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food), Json)));
        var otherId = other.GetProperty("id").GetGuid();
        await using (var scope = logged.Services.CreateAsyncScope())
        {
            var repository = scope.ServiceProvider.GetRequiredService<Platform.Infrastructure.Core.Domain.IAggregateRootRepository<AmarGram.Domain.Aggregates.Subscription.SubscriptionAggregate>>();
            var subscription = (await repository.GetByIdAsync(otherId))!;
            subscription.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Now, new Platform.Infrastructure.Common.Security.UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid());
            await repository.UpdateAsync(subscription, Platform.Infrastructure.Core.Commands.EventPublishOption.InMemoryPublishOnly);
        }

        var admin = await SignInOnAsync(logged, shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId);
        await ExpectAsync(HttpStatusCode.OK, await admin.PostAsJsonAsync($"/api/staff/subscriptions/{otherId}/reinstate", new { reason }, Json));
        await using (var scope = logged.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<AmarGram.Api.Background.SubscriptionWorkCycle>().RunAsync(default, shop.CustomerId);

        var all = string.Join("\n", logs);
        Assert.NotEmpty(logs);
        Assert.DoesNotContain(note, all);
        Assert.DoesNotContain(reason, all);
    }

    private async Task<HttpClient> SignInOnAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> host, Guid customerId)
    {
        var client = CreateClientOn(host);
        var mobile = await WithDbAsync(async db => (await db.Set<AmarGram.Domain.Aggregates.Account.CustomerAccountAggregate>().AsNoTracking().SingleAsync(c => c.Id == customerId)).MobileNumber!.Value);
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password = CustomerPassword }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return client;
    }

    private async Task<HttpClient> SignInOnAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> host, string mobile, string password, Guid branchId)
    {
        var client = CreateClientOn(host);
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = mobile, password }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        UseBranch(client, branchId);
        return client;
    }

    // ── H: lifecycle (ADR-247) ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_H3_AMerge_MovesTheDuplicatesSubscriptionsToTheSurvivor_AndCancelsTheOneTheSurvivorAlreadyHas()
    {
        var shop = await SetUpSubscribableShopAsync();
        await SetSubscribableAsync(shop.Context, shop.Bag);
        var survivor = shop.Customer;
        var survivorId = shop.CustomerId;
        var duplicate = await AddCustomerAsync(shop);

        var shared = NewMobile();
        await ExpectAsync(HttpStatusCode.NoContent, await survivor.PutAsJsonAsync("/api/customers/me", new { fullName = "Merged Customer", additionalPhoneNumbers = new[] { shared } }, Json));
        await ExpectAsync(HttpStatusCode.NoContent, await duplicate.Client.PutAsJsonAsync("/api/customers/me", new { fullName = "Merged Customer", additionalPhoneNumbers = new[] { shared } }, Json));

        // The survivor and the duplicate both subscribe to the food; the duplicate also subscribes to the bag.
        var survivorFood = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();
        var duplicateFood = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await duplicate.Client.PostAsJsonAsync("/api/customers/me/subscriptions",
            CreateBody(shop, shop.Food, addressId: duplicate.AddressId), Json)));
        var duplicateBag = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await duplicate.Client.PostAsJsonAsync("/api/customers/me/subscriptions",
            CreateBody(shop, shop.Bag, addressId: duplicate.AddressId), Json)));

        await ExpectAsync(HttpStatusCode.OK, await shop.Context.Admin.PostAsJsonAsync($"/api/staff/customers/{duplicate.CustomerId}/merge",
            new { survivingCustomerId = survivorId, reason = "Same person registered twice" }, Json));

        var subscriptions = await WithDbAsync(db => db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == survivorId || s.CustomerId == duplicate.CustomerId).ToListAsync());
        Assert.All(subscriptions, s => Assert.Equal(survivorId, s.CustomerId));                                   // everything follows the survivor
        Assert.Equal(SubscriptionStatus.Active, subscriptions.Single(s => s.Id == survivorFood).Status);
        var cancelled = subscriptions.Single(s => s.Id == duplicateFood.GetProperty("id").GetGuid());             // the survivor already had the food
        Assert.Equal(SubscriptionStatus.Cancelled, cancelled.Status);
        Assert.Equal(SubscriptionCancellationReason.CustomerMerged, cancelled.CancellationReason);
        Assert.Equal(SubscriptionStatus.Active, subscriptions.Single(s => s.Id == duplicateBag.GetProperty("id").GetGuid()).Status);   // the bag moved over, still live

        // The survivor sees the moved subscription as their own.
        var mine = await ReadAsync(await survivor.GetAsync("/api/customers/me/subscriptions?status=live"));
        Assert.Contains(mine.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == duplicateBag.GetProperty("id").GetGuid());
        Assert.Equal(2, subscriptions.Count(s => s.Status != SubscriptionStatus.Cancelled));

        // The rows are untouched by a re-send of the same event (the handler is idempotent).
        var versions = subscriptions.ToDictionary(s => s.Id, s => s.Version);
        await WithScopeAsync(async sp =>
        {
            var handler = sp.GetServices<Platform.Infrastructure.Core.Events.IEventHandlerAsync<AmarGram.Domain.Events.Account.CustomerMergedEvent>>()
                .OfType<AmarGram.Application.DomainEventHandlers.Subscription.ReassignSubscriptionsOnCustomerMergedHandler>().Single();
            await handler.HandleAsync(new AmarGram.Domain.Events.Account.CustomerMergedEvent
            { DuplicateCustomerId = duplicate.CustomerId, SurvivingCustomerId = survivorId, Reason = "again", IsReapplication = true });
            return 0;
        });
        var after = await WithDbAsync(db => db.Subscriptions.AsNoTracking().Where(s => versions.Keys.Contains(s.Id)).ToListAsync());
        Assert.All(after, s => Assert.Equal(versions[s.Id], s.Version));
    }

    [Fact]
    public async Task I_H4_ErasingACustomersAccount_CancelsEverySubscription_AndNoOrderIsRaisedForThem()
    {
        var shop = await SetUpSubscribableShopAsync();
        await SetSubscribableAsync(shop.Context, shop.Bag);
        var food = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();
        var bag = (await SubscribeAsync(shop, sku: shop.Bag)).GetProperty("id").GetGuid();
        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, bag, "pause"));
        var due = Today.AddDays(3);

        await ExpectAsync(HttpStatusCode.OK, await shop.Context.Admin.PostAsJsonAsync($"/api/admin/customers/{shop.CustomerId}/erasure",
            new { channel = "Phone", identityCheck = "RegisteredMobileCallback" }, Json));

        var subscriptions = await WithDbAsync(db => db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == shop.CustomerId).ToListAsync());
        Assert.Equal(2, subscriptions.Count);
        Assert.All(subscriptions, s =>
        {
            Assert.Equal(SubscriptionStatus.Cancelled, s.Status);
            Assert.Equal(SubscriptionCancellationReason.AccountDeleted, s.CancellationReason);
            Assert.Null(s.NextDeliveryOn);
        });

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);
        Assert.Empty(await OrdersOfAsync(shop.CustomerId));
        Assert.NotEqual(food, bag);
    }
}
