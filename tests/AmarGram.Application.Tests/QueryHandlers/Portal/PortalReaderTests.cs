using AmarGram.Application.Tests.TestSupport;
using AmarGram.Read.Queries.Billing;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.Queries.Order;
using AmarGram.Read.QueryHandlers.Order;
using AmarGram.Read.QueryHandlers.Portal;
using AmarGram.Read.QueryHandlers.Portal.Sections;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Application.Tests.QueryHandlers.Portal;

/// <summary>HO-POR-001 §15 group B -- one section reader at a time against hand-written upstream fakes (ADR-259).</summary>
public sealed class PortalReaderTests
{
    private static readonly Guid CustomerId = Guid.NewGuid();
    private static readonly PortalCaller Caller = new(CustomerId, PortalTestCallers.For(CustomerId), Guid.NewGuid());

    // ── Profile ─────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Profile_MapsFullNameOnly_AndAMissingProfileIsAnUpstreamFault()
    {
        var found = new FakeQueryHandler<GetCustomerProfileQuery, CustomerProfileViewModel?>(_ =>
            new CustomerProfileViewModel("Nusrat Jahan", "01711111111", "n@example.test", true, true, true, [], DateTimeOffset.UtcNow));
        Assert.Equal("Nusrat Jahan", (await new ProfileReader(found).ReadAsync(Caller)).FullName);
        Assert.Equal(typeof(string), Assert.Single(typeof(PortalCustomerViewModel).GetProperties()).PropertyType);

        var missing = new FakeQueryHandler<GetCustomerProfileQuery, CustomerProfileViewModel?>(_ => null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => new ProfileReader(missing).ReadAsync(Caller));
    }

    // ── Balances ────────────────────────────────────────────────────────────────────────────────────
    private static MoneyViewModel Money(string amount, string currency = "BDT") => new(amount, currency);

    private static CustomerBillingSummaryViewModel Summary(string outstanding, string overdue = "0.00", DateOnly? oldest = null, string currency = "BDT") =>
        new(Money(outstanding, currency), Money(overdue, currency), Money("0.00", currency), [], Money("0.00", currency), null, false, oldest);

    private static InvoiceSummaryViewModel Invoice(string status, string balance, DateOnly? dueOn, string number = "INV-1", string currency = "BDT") =>
        new(Guid.NewGuid(), number, status, CustomerId, "", Guid.NewGuid(), new DateOnly(2026, 9, 1), dueOn,
            Money("1500.00", currency), Money("0.00", currency), Money("0.00", currency), Money(balance, currency), 1);

    private static BalancesSectionReader BalancesReader(
        CustomerBillingSummaryViewModel summary, IReadOnlyList<InvoiceSummaryViewModel> invoices,
        out FakeQueryHandler<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel> summaryHandler,
        out FakeQueryHandler<GetCustomerInvoicesQuery, PagedResult<InvoiceSummaryViewModel>> invoiceHandler)
    {
        summaryHandler = new(_ => summary);
        invoiceHandler = new(q => new PagedResult<InvoiceSummaryViewModel>(invoices, q.PageNumber, q.PageSize, invoices.Count));
        return new BalancesSectionReader(summaryHandler, invoiceHandler);
    }

    [Fact]
    public async Task U_B11_Balances_OutstandingIsNeverSummedAcrossCurrencies_AndZeroMeansNoOutstandingAndAnEmptyList()
    {
        // Billing returns one Money in the commerce currency (real contract); a USD summary is never added to a BDT one.
        var bdt = await BalancesReader(Summary("1500.00", "500.00", new DateOnly(2026, 9, 1)), [], out _, out _).ReadAsync(Caller);
        var usd = await BalancesReader(Summary("20.00", currency: "USD"), [], out _, out _).ReadAsync(Caller);

        Assert.True(bdt.HasOutstanding);
        Assert.Equal([new PortalMoneyViewModel("1500.00", "BDT")], bdt.Outstanding);
        Assert.Equal([new PortalMoneyViewModel("500.00", "BDT")], bdt.Overdue);
        Assert.Equal(new DateOnly(2026, 9, 1), bdt.OldestDueOn);
        Assert.Equal([new PortalMoneyViewModel("20.00", "USD")], usd.Outstanding);

        var none = await BalancesReader(Summary("0.00"), [], out _, out _).ReadAsync(Caller);
        Assert.False(none.HasOutstanding);
        Assert.Empty(none.Outstanding);
        Assert.Empty(none.Overdue);
    }

    [Fact]
    public async Task Balances_OpenInvoicesOnly_OldestDueFirst_LimitFive_CountIsAllOpen_HowToPayIsGuidanceOnly()
    {
        var invoices = new List<InvoiceSummaryViewModel>
        {
            Invoice("Paid", "0.00", new DateOnly(2026, 8, 1), "PAID"),
            Invoice("Credited", "0.00", new DateOnly(2026, 8, 2), "CREDITED"),
            Invoice("Issued", "100.00", new DateOnly(2026, 11, 1), "D"),
            Invoice("PartPaid", "50.00", new DateOnly(2026, 9, 1), "B"),
            Invoice("Issued", "10.00", null, "NODUE"),
            Invoice("Issued", "70.00", new DateOnly(2026, 10, 1), "C"),
            Invoice("Issued", "20.00", new DateOnly(2026, 8, 15), "A"),
            Invoice("Issued", "30.00", new DateOnly(2026, 12, 1), "E"),
        };

        var section = await BalancesReader(Summary("280.00"), invoices, out _, out _).ReadAsync(Caller);

        Assert.Equal(6, section.OpenInvoiceCount);
        Assert.Equal(["A", "B", "C", "D", "E"], section.Invoices.Select(i => i.InvoiceNumber));
        Assert.Equal(PortalMessages.HowToPayOffline, section.HowToPay);
        Assert.Equal("20.00", section.Invoices[0].BalanceDue.Amount);
        Assert.DoesNotContain(typeof(PortalBalancesViewModel).GetProperties().Concat(typeof(PortalInvoiceItemViewModel).GetProperties()),
            p => new[] { "Url", "Link", "Gateway", "Checkout" }.Any(w => p.Name.Contains(w, StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public async Task Balances_WalksInvoicePages_UntilTheLastOne_AndStopsAtTheCap()
    {
        var summaryHandler = new FakeQueryHandler<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel>(_ => Summary("1.00"));
        var invoiceHandler = new FakeQueryHandler<GetCustomerInvoicesQuery, PagedResult<InvoiceSummaryViewModel>>(q =>
            new PagedResult<InvoiceSummaryViewModel>(
                Enumerable.Range(0, PortalRules.BalanceInvoicePageSize).Select(_ => Invoice("Paid", "0.00", null)).ToList(),
                q.PageNumber, q.PageSize, 10_000));

        await new BalancesSectionReader(summaryHandler, invoiceHandler).ReadAsync(Caller);

        Assert.Equal(PortalRules.BalanceInvoiceMaxPages, invoiceHandler.Received.Count);
        Assert.Equal(Enumerable.Range(1, PortalRules.BalanceInvoiceMaxPages), invoiceHandler.Received.Select(q => q.PageNumber));
        Assert.All(invoiceHandler.Received, q => Assert.Equal(PortalRules.BalanceInvoicePageSize, q.PageSize));
    }

    private static bool CustomerOrderRulesFor(string status) => status is "Cancelled" or "Delivered" or "Returned" or "Refunded";   // fixture only

    // ── Orders ──────────────────────────────────────────────────────────────────────────────────────
    private static CustomerOrderSummaryViewModel OrderRow(string status, DateTimeOffset placedOn, string number = "SO-1", string? tracking = null) =>
        new(Guid.NewGuid(), number, placedOn, status, "Delivery", "CashOnDelivery", Money("3450.00"), 3, "Asia/Dhaka", tracking, CustomerOrderRulesFor(status));

    [Fact]
    public async Task U_B13_Orders_LimitFive_TotalPassedThroughUnsummed_QueryCarriesTheCaller()
    {
        var at = new DateTimeOffset(2026, 10, 1, 8, 0, 0, TimeSpan.Zero);
        IReadOnlyList<CustomerOrderSummaryViewModel> rows = Enumerable.Range(0, 6).Select(i => OrderRow("Delivered", at.AddDays(-i), "SO-" + i)).ToList();
        var handler = new FakeQueryHandler<GetCustomerOrdersQuery, PagedResult<CustomerOrderSummaryViewModel>>(q => new(rows, q.PageNumber, q.PageSize, rows.Count));

        var section = await new OrdersSectionReader(handler).ReadAsync(Caller);

        Assert.Equal(PortalRules.DashboardItemLimit, section.Items.Count);
        Assert.Equal(new PortalMoneyViewModel("3450.00", "BDT"), section.Items[0].Total);
        var query = Assert.Single(handler.Received);
        Assert.Equal(CustomerId, query.CustomerId);
        Assert.Equal(1, query.PageNumber);
        Assert.Equal(PortalRules.DashboardItemLimit, query.PageSize);
    }

    [Theory]
    [InlineData("Cancelled", true)]
    [InlineData("Delivered", true)]
    [InlineData("Returned", true)]
    [InlineData("Refunded", true)]
    [InlineData("PendingPayment", false)]
    [InlineData("Confirmed", false)]
    [InlineData("Packing", false)]
    [InlineData("Dispatched", false)]
    public void U_B13_OrdersCanReorderRule_PerStatus_IsTheSingleSourceOrdersListAndDetailShare(string status, bool expected)
    {
        var parsed = new[] { OrderStatus.PendingPayment, OrderStatus.Confirmed, OrderStatus.Packing, OrderStatus.Dispatched, OrderStatus.Delivered,
            OrderStatus.Cancelled, OrderStatus.Returned, OrderStatus.Refunded }.Single(s => s.DisplayName == status);
        Assert.Equal(expected, CustomerOrderRules.CanReorder(parsed));
    }

    [Fact]
    public async Task Orders_CanReorderAndTrackingNumber_ArePassedThroughFromOrdersListItem()
    {
        var withTracking = OrderRow("Dispatched", DateTimeOffset.UtcNow, tracking: "TRK-9");
        var handler = new FakeQueryHandler<GetCustomerOrdersQuery, PagedResult<CustomerOrderSummaryViewModel>>(
            _ => new([withTracking with { CanReorder = true }], 1, 5, 1));   // the flag is Orders' to decide: the portal does not recompute it

        var item = Assert.Single((await new OrdersSectionReader(handler).ReadAsync(Caller)).Items);

        Assert.True(item.CanReorder);
        Assert.Equal("TRK-9", item.TrackingNumber);
    }

    [Fact]
    public async Task Orders_NewestFirst_AndTheItemHasNoPaymentOrBankField()
    {
        var at = new DateTimeOffset(2026, 10, 1, 8, 0, 0, TimeSpan.Zero);
        var handler = new FakeQueryHandler<GetCustomerOrdersQuery, PagedResult<CustomerOrderSummaryViewModel>>(
            _ => new([OrderRow("Delivered", at, "OLD"), OrderRow("Delivered", at.AddDays(3), "NEW")], 1, 5, 2));

        var section = await new OrdersSectionReader(handler).ReadAsync(Caller);

        Assert.Equal(["NEW", "OLD"], section.Items.Select(i => i.OrderNumber));
        Assert.Equal(["CanReorder", "ItemCount", "OrderId", "OrderNumber", "PlacedOn", "Status", "Total", "TrackingNumber"],
            typeof(PortalOrderItemViewModel).GetProperties().Select(p => p.Name).Order(StringComparer.Ordinal));
    }

    // ── U-B12: every reader hands its upstream queries the caller id, UserContext and CorrelationId ──
    [Fact]
    public async Task U_B12_EveryReader_PassesTheCallerIdUserContextAndCorrelationIdToItsUpstreamQueries()
    {
        var profile = new FakeQueryHandler<GetCustomerProfileQuery, CustomerProfileViewModel?>(_ =>
            new CustomerProfileViewModel("N", null, null, false, false, false, [], DateTimeOffset.UtcNow));
        await new ProfileReader(profile).ReadAsync(Caller);
        Assert.All(profile.Received, q => { Assert.Equal(CustomerId, q.CustomerId); Assert.Same(Caller.UserContext, q.UserContext); Assert.Equal(Caller.CorrelationId, q.CorrelationId); });

        var orders = new FakeQueryHandler<GetCustomerOrdersQuery, PagedResult<CustomerOrderSummaryViewModel>>(_ => new([], 1, 5, 0));
        await new OrdersSectionReader(orders).ReadAsync(Caller);
        Assert.All(orders.Received, q => { Assert.Equal(CustomerId, q.CustomerId); Assert.Same(Caller.UserContext, q.UserContext); Assert.Equal(Caller.CorrelationId, q.CorrelationId); });

        var balances = BalancesReader(Summary("0.00"), [], out var summaryHandler, out var invoiceHandler);
        await balances.ReadAsync(Caller);
        Assert.All(summaryHandler.Received, q => { Assert.Equal(CustomerId, q.CustomerId); Assert.Same(Caller.UserContext, q.UserContext); Assert.Equal(Caller.CorrelationId, q.CorrelationId); });
        Assert.All(invoiceHandler.Received, q => { Assert.Equal(CustomerId, q.CustomerId); Assert.Same(Caller.UserContext, q.UserContext); Assert.Equal(Caller.CorrelationId, q.CorrelationId); });
    }
}
