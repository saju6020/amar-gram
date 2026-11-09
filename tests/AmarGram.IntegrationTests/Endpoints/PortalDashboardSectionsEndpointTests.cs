using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Billing;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Core.Queries;
using Xunit;
using Xunit.Abstractions;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-POR-001 §16 groups A and B for the dashboard sections: customer, balances (BIL) and orders (ORD). Upstream data is arranged
/// through the owning modules' own endpoints and ports (§16.1 rule 2); every test mints its own customers.</summary>
public sealed class PortalDashboardSectionsEndpointTests(PortalApiFactory factory, ITestOutputHelper output) : PortalIntegrationTestBase(factory)
{
    private const decimal InvoiceAmount = 1500m;

    private sealed record Scenario(PortalCustomer Customer, Guid InvoiceId);

    private static readonly SemaphoreSlim ScenarioLock = new(1, 1);
    private static Scenario? _shared;

    /// <summary>The I-B2 customer with an issued invoice. Built once for the class (the customer is read-only afterwards).</summary>
    private async Task<Scenario> SharedScenarioAsync()
    {
        await ScenarioLock.WaitAsync();
        try { return _shared ??= await BuildScenarioAsync(Factory); }
        finally { ScenarioLock.Release(); }
    }

    private async Task<Scenario> BuildScenarioAsync(PortalApiFactory host)
    {
        _ = host;
        var branch = await SeedBranchAsync();
        var taxClassId = await PrepareBillingAsync(branch);
        var customer = await RegisterCustomerAsync("Nusrat Jahan");

        var invoiceId = await IssueInvoiceAsync(branch, taxClassId, customer.CustomerId, InvoiceAmount);

        return new Scenario(customer, invoiceId);
    }

    // I-B2 -- US-POR-01 AC1
    [Fact]
    public async Task I_B2_EverySectionIsReady_AndTheBalancesArePopulated()
    {
        var s = await SharedScenarioAsync();

        var board = await GetDashboardAsync(s.Customer.Client);

        foreach (var section in new[] { "customer", "balances", "orders" })
            Assert.Equal("Ready", board.GetProperty(section).GetProperty("state").GetString());

        var balances = board.GetProperty("balances").GetProperty("data");
        Assert.True(balances.GetProperty("hasOutstanding").GetBoolean());
        var outstanding = Assert.Single(balances.GetProperty("outstanding").EnumerateArray());
        Assert.Equal(InvoiceAmount, decimal.Parse(outstanding.GetProperty("amount").GetString()!, CultureInfo.InvariantCulture));
        Assert.Equal("BDT", outstanding.GetProperty("currencyCode").GetString());
        Assert.Equal(1, balances.GetProperty("openInvoiceCount").GetInt32());
        Assert.Equal(s.InvoiceId, Assert.Single(balances.GetProperty("invoices").EnumerateArray()).GetProperty("invoiceId").GetGuid());
        Assert.Equal(PortalMessages.HowToPayOffline, balances.GetProperty("howToPay").GetString());
    }

    // I-B3 -- ADR-261 (IDOR): each customer sees only their own records, and nothing the client sends changes whose dashboard it is
    [Fact]
    public async Task I_B3_TwoCustomers_EachDashboardHasOnlyItsOwnRecords_AndAForgedCustomerIdIsIgnored()
    {
        var branch = await SeedBranchAsync();
        var taxClassId = await PrepareBillingAsync(branch);
        var first = await RegisterCustomerAsync("Owner One");
        var second = await RegisterCustomerAsync("Owner Two");

        var firstInvoice = await IssueInvoiceAsync(branch, taxClassId, first.CustomerId, 300m);
        var secondInvoice = await IssueInvoiceAsync(branch, taxClassId, second.CustomerId, 700m);

        var firstBoard = await GetDashboardAsync(first.Client);
        var secondBoard = await GetDashboardAsync(second.Client);

        Assert.Equal("Owner One", firstBoard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
        Assert.Equal("Owner Two", secondBoard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
        Assert.Equal([firstInvoice], Ids(firstBoard, "balances", "invoiceId", "invoices"));
        Assert.Equal([secondInvoice], Ids(secondBoard, "balances", "invoiceId", "invoices"));
        Assert.Equal("300.00", firstBoard.GetProperty("balances").GetProperty("data").GetProperty("outstanding")[0].GetProperty("amount").GetString());

        // A client cannot choose whose dashboard it gets: the query has no customer-id property, and a forged one is simply never bound.
        var forged = await first.Client.GetAsync($"/api/portal/dashboard?customerId={second.CustomerId}&ownerId={second.CustomerId}");
        await ExpectAsync(HttpStatusCode.OK, forged);
        var forgedBoard = await ReadAsync(forged);
        Assert.Equal([firstInvoice], Ids(forgedBoard, "balances", "invoiceId", "invoices"));
        Assert.Equal("Owner One", forgedBoard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
    }

    private static List<Guid> Ids(JsonElement board, string section, string idName, string list = "items") =>
        board.GetProperty(section).GetProperty("data").GetProperty(list).EnumerateArray().Select(i => i.GetProperty(idName).GetGuid()).ToList();

    // I-B1 -- a customer with nothing recorded gets Ready/empty everywhere
    [Fact]
    public async Task I_B1_NewCustomer_BalancesAreReadyAndEmpty_NotUnavailable()
    {
        var customer = await RegisterCustomerAsync();

        var board = await GetDashboardAsync(customer.Client);

        Assert.Equal("Ready", board.GetProperty("balances").GetProperty("state").GetString());
        var balances = board.GetProperty("balances").GetProperty("data");
        Assert.False(balances.GetProperty("hasOutstanding").GetBoolean());
        Assert.Empty(balances.GetProperty("outstanding").EnumerateArray());
        Assert.Empty(balances.GetProperty("overdue").EnumerateArray());
        Assert.Equal(0, balances.GetProperty("openInvoiceCount").GetInt32());
        Assert.Empty(balances.GetProperty("invoices").EnumerateArray());
    }

    // I-B5 -- ADR-260 with a test-host override (a throwing fake), not a production switch
    [Fact]
    public async Task I_B5_ABalancesHandlerThatThrows_Leaves200_WithBalancesUnavailableAndNullData_AndOneErrorLogWithTheCorrelationId()
    {
        var (logged, logs) = Factory.WithCapturedLogs();
        using var host = logged.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            var existing = services.Single(d => d.ServiceType == typeof(IQueryHandlerAsync<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel>));
            services.Remove(existing);
            services.AddScoped<IQueryHandlerAsync<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel>, ThrowingBillingSummaryHandler>();
        }));

        var customer = await RegisterCustomerAsync("Nusrat Jahan", host);

        var response = await customer.Client.GetAsync("/api/portal/dashboard");
        await ExpectAsync(HttpStatusCode.OK, response);
        var board = await ReadAsync(response);

        Assert.Equal("Unavailable", board.GetProperty("balances").GetProperty("state").GetString());
        Assert.Equal(JsonValueKind.Null, board.GetProperty("balances").GetProperty("data").ValueKind);
        foreach (var section in new[] { "customer", "orders" })
            Assert.Equal("Ready", board.GetProperty(section).GetProperty("state").GetString());
        Assert.Equal("Nusrat Jahan", board.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());

        // The captured line is "{category}: {message}[ | {exception}]" (the level is asserted by unit test U-B1).
        var errorLines = logs.Where(l => l.Contains("Portal section balances unavailable", StringComparison.Ordinal)).ToList();
        var line = Assert.Single(errorLines);
        Assert.StartsWith("AmarGram.Read.QueryHandlers.Portal.PortalSectionComposer: ", line, StringComparison.Ordinal);
        Assert.Matches(@"CorrelationId=[0-9a-fA-F-]{36}", line);
        Assert.Contains("billing is down", line, StringComparison.Ordinal); // the exception is attached to the entry
        Assert.DoesNotContain("Nusrat", line); // I-X1: no customer data on the line
    }

    private sealed class ThrowingBillingSummaryHandler : IQueryHandlerAsync<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel>
    {
        public Task<QueryResponse<CustomerBillingSummaryViewModel>> HandleAsync(GetCustomerBillingSummaryQuery query) =>
            throw new InvalidOperationException("billing is down");
    }

    // I-A2 -- no persistence (ADR-257): the model has no Portal entity or table, and no migration mentions the portal.
    [Fact]
    public async Task I_A2_ThePortalOwnsNoEntityTableOrMigration()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AmarGramDbContext>();

        var entityNames = db.Model.GetEntityTypes().Select(e => e.Name + "|" + e.GetTableName() + "|" + e.GetSchema()).ToList();
        Assert.DoesNotContain(entityNames, n => n.Contains("portal", StringComparison.OrdinalIgnoreCase));

        var migrations = typeof(AmarGramDbContext).Assembly.GetTypes().Where(t => t.Namespace?.EndsWith("Migrations", StringComparison.Ordinal) == true);
        Assert.DoesNotContain(migrations, t => t.Name.Contains("Portal", StringComparison.Ordinal));
    }

    // I-B8 -- NFR-PRF-3 (acceptance A17): 20 sequential dashboard calls for a customer with records in EVERY built section; p95 <= 1500 ms.
    // The customer has a profile, an issued (outstanding) invoice and a PLACED order made through Ordering's customer endpoints.
    [Fact]
    public async Task I_B8_TwentySequentialDashboardCalls_P95IsWithinOneAndAHalfSeconds()
    {
        var branch = await SeedBranchAsync();
        var taxClassId = await PrepareBillingAsync(branch);
        var customer = await RegisterCustomerAsync("Latency Customer");

        await IssueInvoiceAsync(branch, taxClassId, customer.CustomerId, InvoiceAmount);
        using (var ordering = new OrderingShopHelper(new OrderingApiFactory()))
            await ordering.PlaceCashOnDeliveryOrderAsync(customer.Mobile, CustomerPassword, customer.CustomerId);

        // The measured board really is populated in every built section (otherwise the timing proves nothing).
        var board = await GetDashboardAsync(customer.Client);
        foreach (var section in new[] { "customer", "balances", "orders" })
            Assert.Equal("Ready", board.GetProperty(section).GetProperty("state").GetString());
        Assert.Equal("Latency Customer", board.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
        Assert.NotEmpty(board.GetProperty("balances").GetProperty("data").GetProperty("invoices").EnumerateArray()); // the seeded invoice and the order's own
        Assert.Single(board.GetProperty("orders").GetProperty("data").GetProperty("items").EnumerateArray());

        var timings = new List<double>();
        for (var i = 0; i < 20; i++)
        {
            var watch = Stopwatch.StartNew();
            await ExpectAsync(HttpStatusCode.OK, await customer.Client.GetAsync("/api/portal/dashboard"));
            timings.Add(watch.Elapsed.TotalMilliseconds);
        }

        timings.Sort();
        var p95 = timings[(int)Math.Ceiling(0.95 * timings.Count) - 1];
        output.WriteLine($"I-B8 dashboard p95 = {p95:F0} ms (min {timings[0]:F0}, median {timings[timings.Count / 2]:F0}, max {timings[^1]:F0}) over {timings.Count} calls, all 3 sections populated: customer, balances, orders");
        Assert.True(p95 <= 1500, $"p95 {p95:F0} ms exceeds the 1500 ms budget");
    }

    // I-X1 -- nothing sensitive reaches the log: no customer name, mobile or money amount
    [Fact]
    public async Task I_X1_TheLogsOfADashboardRead_CarryNoCustomerNameMobileOrMoney()
    {
        const decimal amount = 7351.42m;
        var branch = await SeedBranchAsync();
        var taxClassId = await PrepareBillingAsync(branch);
        var (logged, logs) = Factory.WithCapturedLogs();
        using var host = logged.WithWebHostBuilder(_ => { });

        var customer = await RegisterCustomerAsync("Zainab Quddus", host);
        await IssueInvoiceAsync(branch, taxClassId, customer.CustomerId, amount);
        var before = logs.Count;

        var board = await GetDashboardAsync(customer.Client);
        await GetDashboardAsync(customer.Client);
        await GetDashboardAsync(customer.Client);

        // The amount really is on the board (so its absence from the log is meaningful) ...
        Assert.Equal("7351.42", board.GetProperty("balances").GetProperty("data").GetProperty("outstanding")[0].GetProperty("amount").GetString());
        Assert.True(logs.Count > before, "the dashboard reads produced no log lines at all");

        // ... and appears in no captured line (registration, arrangement and the three reads), in any common rendering.
        var lines = logs.ToList();
        Assert.All(lines, l => Assert.DoesNotContain("Zainab", l));
        Assert.All(lines, l => Assert.DoesNotContain(customer.Mobile, l));
        Assert.All(lines, l => Assert.DoesNotContain("7351", l));
        Assert.All(lines, l => Assert.DoesNotContain("7,351", l));
    }
}

/// <summary>Arranges Ordering's shop (branch, billing profile, SKUs, delivery zone) through its own endpoints and places a cash-on-delivery order for a customer
/// registered on another host over the same database. The customer signs in again on the Ordering host: its clock follows the wall clock, so the shop's
/// prices are in force there (the portal host's frozen clock was created earlier and does not see them yet). Owns the Ordering factory it was given.</summary>
internal sealed class OrderingShopHelper(OrderingApiFactory factory) : OrderingShopTestBase(factory), IDisposable
{
    public void Dispose() => factory.Dispose();

    public async Task PlaceCashOnDeliveryOrderAsync(string mobile, string password, Guid customerId)
    {
        var customerClient = CreateClientOn(factory);
        var signIn = await customerClient.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        customerClient.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));

        var shop = await SetUpShopAsync(fillCart: false);
        var addressId = await AddAddressAsync(customerClient, shop.District);
        await ExpectAsync(HttpStatusCode.Created, await customerClient.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Food.SkuId, quantity = 2 }, Json));
        await ExpectAsync(HttpStatusCode.Created, await customerClient.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Bag.SkuId, quantity = 1 }, Json));
        await PlaceCodOrderAsync(shop with { Customer = customerClient, CustomerId = customerId, AddressId = addressId });
    }
}
