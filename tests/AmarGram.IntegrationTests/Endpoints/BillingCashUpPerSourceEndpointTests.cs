using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P4 BG-20 -- the till count per source (the till, each staff collector of cash on delivery): the sources the read lists, the
/// per-source variance the server computes, and that a total-only count still works exactly as before.</summary>
public sealed class BillingCashUpPerSourceEndpointTests(BillingApiFactory factory) : BillingIntegrationTestBase(factory)
{
    private static string Url(DateOnly date, string suffix = "") => $"/api/staff/billing/cash-ups/{date:yyyy-MM-dd}{suffix}";

    private static async Task<JsonElement> ViewAsync(HttpClient client, DateOnly date) =>
        await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await client.GetAsync(Url(date))));

    private static Task<HttpResponseMessage> CountBySourceAsync(HttpClient client, DateOnly date, string? explanation, params (string Key, decimal Counted)[] counts) =>
        client.PutAsJsonAsync(Url(date, "/count"), new { countedCash = 0m, explanation, counts = counts.Select(c => new { sourceKey = c.Key, countedCash = c.Counted }).ToArray() }, Json);

    private static JsonElement Source(JsonElement view, string key) =>
        view.GetProperty("sources").EnumerateArray().Single(s => s.GetProperty("key").GetString() == key);

    private async Task<(BillingContext Context, string StaffKey)> DayWithTillAndStaffCodAsync()
    {
        var context = await CreateBillingContextAsync();
        var customerId = await SeedCustomerAsync(context);
        await RecordPaymentAsync(context.Admin, customerId, "CashInStore", 1000m);
        await RecordPaymentAsync(context.Admin, customerId, "CashOnDelivery", 200m, collector: new { kind = "Staff", staffAccountId = context.AdminStaffId });
        await RecordPaymentAsync(context.Admin, customerId, "CashOnDelivery", 900m, collector: new { kind = "Courier", courierCode = "PATHAO", courierName = "Pathao Courier" });
        await RecordPaymentAsync(context.Admin, customerId, "CardInStore", 700m, reference: "004512");
        return (context, $"staff:{context.AdminStaffId}");
    }

    [Fact]
    public async Task TheRead_ListsTheTillAndEachStaffCollector_AndTheyAddUpToTheExpectedCash()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();

        var view = await ViewAsync(context.Admin, Today);

        var sources = view.GetProperty("sources").EnumerateArray().ToList();
        Assert.Equal(2, sources.Count); // courier-held COD and card are not cash anywhere
        Assert.Equal("till", sources[0].GetProperty("key").GetString());
        Assert.Equal("Till", sources[0].GetProperty("label").GetString());
        Assert.Equal(1000m, AmountOf(sources[0].GetProperty("expected")));
        Assert.Equal(staffKey, sources[1].GetProperty("key").GetString());
        Assert.False(string.IsNullOrWhiteSpace(sources[1].GetProperty("label").GetString()));
        Assert.Equal(200m, AmountOf(sources[1].GetProperty("expected")));
        Assert.Equal(AmountOf(view.GetProperty("expected").GetProperty("expectedCash")), sources.Sum(s => AmountOf(s.GetProperty("expected"))));
        Assert.All(sources, s => { Assert.Equal(JsonValueKind.Null, s.GetProperty("counted").ValueKind); Assert.Equal(JsonValueKind.Null, s.GetProperty("variance").ValueKind); });

        // The lines say which source each cash line belongs to.
        var staffLine = view.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("sourceKey").ValueKind == JsonValueKind.String);
        Assert.Equal(staffKey, staffLine.GetProperty("sourceKey").GetString());
    }

    [Fact]
    public async Task ACountBySource_GivesPerSourceVariances_AndTheServersTotalAndOverallVariance()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();

        var counted = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await CountBySourceAsync(context.Admin, Today, null, ("till", 990m), (staffKey, 205m))));

        Assert.Equal(1195m, AmountOf(counted.GetProperty("counted")));
        Assert.Equal(-5m, AmountOf(counted.GetProperty("variance")));
        Assert.Equal(990m, AmountOf(Source(counted, "till").GetProperty("counted")));
        Assert.Equal(-10m, AmountOf(Source(counted, "till").GetProperty("variance")));
        Assert.Equal(205m, AmountOf(Source(counted, staffKey).GetProperty("counted")));
        Assert.Equal(5m, AmountOf(Source(counted, staffKey).GetProperty("variance")));
    }

    [Fact]
    public async Task ASourceLeftUncounted_IsNullWhileOpen_AndCountedAsNothingOnceClosed()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();

        var open = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await CountBySourceAsync(context.Admin, Today, "Collector not back yet", ("till", 1000m))));
        Assert.Equal(JsonValueKind.Null, Source(open, staffKey).GetProperty("counted").ValueKind);
        Assert.Equal(-200m, AmountOf(open.GetProperty("variance"))); // overall counted 1000 against 1200 expected

        await ExpectAsync(HttpStatusCode.NoContent, await context.Admin.PostAsJsonAsync(Url(Today, "/close"), new { expectedVersion = open.GetProperty("version").GetInt32() }, Json));

        var closed = await ViewAsync(context.Admin, Today);
        Assert.Equal(0m, AmountOf(Source(closed, staffKey).GetProperty("counted")));
        Assert.Equal(-200m, AmountOf(Source(closed, staffKey).GetProperty("variance")));
        Assert.Equal(0m, AmountOf(Source(closed, "till").GetProperty("variance")));
        Assert.Equal(AmountOf(closed.GetProperty("variance")), closed.GetProperty("sources").EnumerateArray().Sum(s => AmountOf(s.GetProperty("variance"))));
    }

    [Fact]
    public async Task TheClosedDaysSources_AreFrozen_WhateverHappensAfter()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();
        var counted = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await CountBySourceAsync(context.Admin, Today, null, ("till", 1000m), (staffKey, 200m))));
        await ExpectAsync(HttpStatusCode.NoContent, await context.Admin.PostAsJsonAsync(Url(Today, "/close"), new { expectedVersion = counted.GetProperty("version").GetInt32() }, Json));

        var customerId = await SeedCustomerAsync(context);
        Factory.Clock.Advance(TimeSpan.FromMinutes(1));
        await RecordPaymentAsync(context.Admin, customerId, "CashInStore", 50m); // arrives after the close: carried into tomorrow, not into this day

        var closed = await ViewAsync(context.Admin, Today);
        Assert.Equal(1000m, AmountOf(Source(closed, "till").GetProperty("expected")));
        Assert.Equal(0m, AmountOf(closed.GetProperty("variance")));

        var recount = await CountBySourceAsync(context.Admin, Today, null, ("till", 5m));
        Assert.Equal(HttpStatusCode.BadRequest, recount.StatusCode);
        Assert.Contains(BusinessViolationCodes.CashUpClosed, await ErrorCodesAsync(recount));
    }

    [Fact]
    public async Task AnUnknownSource_ADuplicate_ANegativeAmount_AndANoSourceCount_AreRefused()
    {
        var (context, _) = await DayWithTillAndStaffCodAsync();

        var unknown = await CountBySourceAsync(context.Admin, Today, null, ($"staff:{Guid.NewGuid()}", 10m));
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Contains(BusinessViolationCodes.UnknownCashUpSource, await ErrorCodesAsync(unknown));

        var duplicate = await CountBySourceAsync(context.Admin, Today, null, ("till", 1m), ("till", 2m));
        Assert.Contains(BusinessViolationCodes.DuplicateCashUpSource, await ErrorCodesAsync(duplicate));

        var negative = await CountBySourceAsync(context.Admin, Today, null, ("till", -1m));
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);

        var threeDecimals = await CountBySourceAsync(context.Admin, Today, null, ("till", 1.005m));
        Assert.Equal(HttpStatusCode.BadRequest, threeDecimals.StatusCode);

        // Nothing was recorded by the refusals.
        Assert.Equal(JsonValueKind.Null, (await ViewAsync(context.Admin, Today)).GetProperty("counted").ValueKind);
    }

    [Fact]
    public async Task ATotalOnlyCount_StillWorks_HasNoPerSourceCounts_AndReplacesAnEarlierSourceCount()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();
        await ExpectAsync(HttpStatusCode.OK, await CountBySourceAsync(context.Admin, Today, null, ("till", 1000m), (staffKey, 200m)));

        var total = await ReadAsync(await ExpectAsync(HttpStatusCode.OK,
            await context.Admin.PutAsJsonAsync(Url(Today, "/count"), new { countedCash = 1150m }, Json)));

        Assert.Equal(1150m, AmountOf(total.GetProperty("counted")));
        Assert.Equal(-50m, AmountOf(total.GetProperty("variance")));
        Assert.All(total.GetProperty("sources").EnumerateArray(), s => Assert.Equal(JsonValueKind.Null, s.GetProperty("counted").ValueKind));
    }

    [Fact]
    public async Task ReceptionCanCountBySource_ButCannotClose()
    {
        var (context, staffKey) = await DayWithTillAndStaffCodAsync();
        var (reception, _) = await StaffClientAsync(context, StaffRoles.Reception);

        var counted = await ExpectAsync(HttpStatusCode.OK, await CountBySourceAsync(reception, Today, null, ("till", 1000m), (staffKey, 200m)));
        var version = (await ReadAsync(counted)).GetProperty("version").GetInt32();

        var close = await reception.PostAsJsonAsync(Url(Today, "/close"), new { expectedVersion = version }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, close.StatusCode);
    }
}
