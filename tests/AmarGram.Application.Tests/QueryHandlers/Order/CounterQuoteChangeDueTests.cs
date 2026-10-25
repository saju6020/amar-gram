using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Read.Queries.Order;
using AmarGram.Read.QueryHandlers.Order;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;

namespace AmarGram.Application.Tests.QueryHandlers.Order;

/// <summary>HO-P4 BG-7 -- the counter quote answers the change due for the cash tendered, by the tender rule the sale itself applies (<c>TenderCalculator</c>).</summary>
public sealed class CounterQuoteChangeDueTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid BranchId = Guid.NewGuid();

    /// <summary>One line of 2 x 50.00 at 0 % tax, 10 on the shelf (or fewer): the sale totals 100.00.</summary>
    private sealed class Loader(decimal sellable = 10m) : ICheckoutInputsLoader
    {
        public Task<CheckoutInputs> LoadAsync(Guid customerId, FulfilmentChoice choice, DateTimeOffset now, CancellationToken ct) => throw new NotSupportedException();

        public Task<CheckoutInputs> LoadCounterAsync(Guid branchId, Guid? customerId, IReadOnlyList<CounterLineRequest> lines, string? discountCode, DateTimeOffset now, CancellationToken ct)
        {
            var catalogue = new FakeCatalogueLookup();
            var sku = catalogue.Add(price: 50m);
            var choice = new FulfilmentChoice(FulfilmentMethod.Counter, null, null, null, null, null, OrderPaymentMethod.InStore, null);
            var requested = lines.Single();
            return Task.FromResult(new CheckoutInputs(
                now, DateOnly.FromDateTime(now.Date), "BDT", [new CheckoutLineInput(Guid.NewGuid(), sku, requested.Quantity, 50m, sellable, 0m)], choice, null, null,
                new HashSet<DateOnly>(), [], null, null, new CustomerDiscountFacts(0, false), new PaymentSettingsFacts(false, 0m, false, false, false), [], branchId));
        }
    }

    private static async Task<CounterQuoteViewModel> QuoteAsync(decimal? tendered, int quantity = 2, decimal sellable = 10m)
    {
        var handler = new GetCounterQuoteQueryHandler(new Loader(sellable), new FakeTimeProvider(Now));
        var response = await handler.HandleAsync(new GetCounterQuoteQuery
        {
            BranchId = BranchId, Lines = [new CounterQuoteLine(Guid.NewGuid(), quantity)], TenderedCash = tendered, CorrelationId = Guid.NewGuid(),
        });
        return response.Result!;
    }

    [Fact]
    public async Task WithoutATenderedAmount_ThereIsNoChangeAndNoShortfall()
    {
        var quote = await QuoteAsync(null);

        Assert.Equal("100.00", quote.Totals.GrandTotal.Amount);
        Assert.Null(quote.ChangeDue);
        Assert.Null(quote.CashShort);
    }

    [Theory]
    [InlineData("150.00", "50.00")]
    [InlineData("100.00", "0.00")]
    [InlineData("100.01", "0.01")]
    [InlineData("1000.00", "900.00")]
    public async Task CashThatCoversTheTotal_GivesTheChange(string tendered, string change)
    {
        var quote = await QuoteAsync(decimal.Parse(tendered, System.Globalization.CultureInfo.InvariantCulture));

        Assert.Equal(change, quote.ChangeDue!.Amount);
        Assert.Equal("BDT", quote.ChangeDue.CurrencyCode);
        Assert.Null(quote.CashShort);
    }

    [Theory]
    [InlineData("99.99", "0.01")]
    [InlineData("40.00", "60.00")]
    [InlineData("0.01", "99.99")]
    public async Task CashThatFallsShort_NamesWhatIsStillMissing_AndGivesNoChange(string tendered, string missing)
    {
        var quote = await QuoteAsync(decimal.Parse(tendered, System.Globalization.CultureInfo.InvariantCulture));

        Assert.Null(quote.ChangeDue);
        Assert.Equal(missing, quote.CashShort!.Amount);
    }

    [Fact]
    public async Task ASaleThatCannotBeMade_ShowsNoChange()
    {
        var quote = await QuoteAsync(500m, quantity: 2, sellable: 1m);   // only one on the shelf: the quote cuts the line down, the sale would be refused

        Assert.Null(quote.ChangeDue);
        Assert.Null(quote.CashShort);
    }
}
