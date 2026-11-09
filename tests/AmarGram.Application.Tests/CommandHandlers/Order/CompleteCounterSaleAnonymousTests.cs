using AmarGram.Application.CommandHandlers.Order;
using AmarGram.Application.Commands.Order;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Order;

/// <summary>
/// HO-P4 BG-8 (owner approved 2026-10-25) -- the anonymous walk-in sale up to the first business refusal: with neither a name nor a mobile the buyer is the counter-sale system
/// account (found or registered by the reserved number), the checks run for no customer, a code limited per customer is refused, and the reserved number can never be named as a buyer.
/// The sale itself (order with no customer, invoice to the system account) is proved over HTTP by the integration tests.
/// </summary>
public sealed class CompleteCounterSaleAnonymousTests
{
    private static readonly UserContext Cashier = new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["Reception"] };
    private static readonly Guid BranchId = Guid.NewGuid();

    private sealed class Finder(CustomerContactFacts? found) : ICounterCustomerFinder
    {
        public List<string> Looked { get; } = [];

        public Task<CustomerContactFacts?> FindActiveByPrimaryMobileAsync(string normalisedMobile, CancellationToken ct)
        {
            Looked.Add(normalisedMobile);
            return Task.FromResult(found);
        }
    }

    private sealed class Registrar(CounterBuyerResolution answer) : ICounterBuyerRegistrar
    {
        public List<(string Mobile, string Name)> Calls { get; } = [];

        public Task<CounterBuyerResolution> FindOrRegisterAsync(string normalisedMobile, string fullName, UserContext userContext, Guid correlationId, CancellationToken ct)
        {
            Calls.Add((normalisedMobile, fullName));
            return Task.FromResult(answer);
        }
    }

    private sealed class Loader(DiscountRuleSet? discount = null) : ICheckoutInputsLoader
    {
        public bool Loaded { get; private set; }
        public Guid? CustomerIdSeen { get; private set; } = Guid.NewGuid();

        public Task<CheckoutInputs> LoadAsync(Guid customerId, FulfilmentChoice choice, DateTimeOffset now, CancellationToken ct) => throw new NotSupportedException();

        public Task<CheckoutInputs> LoadCounterAsync(Guid branchId, Guid? customerId, IReadOnlyList<CounterLineRequest> lines, string? discountCode, DateTimeOffset now, CancellationToken ct)
        {
            Loaded = true;
            CustomerIdSeen = customerId;
            var choice = new FulfilmentChoice(FulfilmentMethod.Counter, null, null, null, null, null, OrderPaymentMethod.InStore, discountCode);
            return Task.FromResult(new CheckoutInputs(
                now, DateOnly.FromDateTime(now.Date), "BDT", [], choice, null, null, new HashSet<DateOnly>(), [], discountCode, discount, new CustomerDiscountFacts(0, false),
                new PaymentSettingsFacts(false, 0m, false, false, false), [], branchId));
        }
    }

    private static FakeAggregateRootRepository<BranchAggregate> Branches()
    {
        var branch = new BranchAggregate(BranchId);
        branch.Create(new BranchCreateDto("MAIN", "Main", "Asia/Dhaka", null, null, null, Cashier, Guid.NewGuid()));
        var repository = new FakeAggregateRootRepository<BranchAggregate>();
        repository.Seed(branch);
        return repository;
    }

    private static CompleteCounterSaleCommand Sale(string name = "", string mobile = "", string? code = null) => new()
    {
        OrderId = Guid.NewGuid(), IdempotencyKey = Guid.NewGuid(), BranchId = BranchId, CustomerName = name, CustomerMobile = mobile, DiscountCode = code,
        Lines = [new CounterSaleLineInput(Guid.NewGuid(), 1)], Tenders = [new CounterTenderInput(TenderMethod.Cash, 100m, null)], UserContext = Cashier, CorrelationId = Guid.NewGuid(),
    };

    private static CompleteCounterSaleCommandHandler Handler(ICounterCustomerFinder finder, ICounterBuyerRegistrar registrar, ICheckoutInputsLoader loader) =>
        new(null!, null!, Branches(), loader, finder, registrar, null!, null!, null!, null!, null!, null!, new FakeTimeProvider(new DateTimeOffset(2026, 10, 25, 8, 0, 0, TimeSpan.Zero)));

    private static string[] Codes(Platform.Infrastructure.Core.Commands.CommandResponse response) => response.ValidationResult?.Errors.Select(e => e.ErrorCode).ToArray() ?? [];

    private static DiscountRuleSet Code(int? perCustomerLimit = null, bool firstOrderOnly = false) => new(
        Guid.NewGuid(), "SAVE10", DiscountKind.Percentage, 1000, null, null, DiscountScope.Order, new HashSet<Guid>(), new HashSet<int>(), firstOrderOnly, null, 0, perCustomerLimit, null, null, true, "BDT");

    [Fact]
    public async Task AnAnonymousSale_ResolvesTheSystemAccountByTheReservedNumber_AndPricesForNoCustomer()
    {
        var system = new CustomerContactFacts(Guid.NewGuid(), AnonymousCounterCustomer.FullName, AnonymousCounterCustomer.NormalisedMobile, IsActive: true);
        var finder = new Finder(system);
        var registrar = new Registrar(CounterBuyerResolution.Refused("X", "x", "x"));
        var loader = new Loader();

        await Handler(finder, registrar, loader).HandleAsync(Sale());

        Assert.Equal([AnonymousCounterCustomer.NormalisedMobile], finder.Looked);
        Assert.Empty(registrar.Calls);                                     // already there: not registered again
        Assert.True(loader.Loaded);
        Assert.Null(loader.CustomerIdSeen);                                // the quote, the discount rules and the order see no customer
    }

    [Fact]
    public async Task TheFirstAnonymousSale_RegistersTheSystemAccount_UnderItsOneNameAndNumber()
    {
        var system = new CustomerContactFacts(Guid.NewGuid(), AnonymousCounterCustomer.FullName, AnonymousCounterCustomer.NormalisedMobile, IsActive: true);
        var registrar = new Registrar(CounterBuyerResolution.Found(system));

        await Handler(new Finder(null), registrar, new Loader()).HandleAsync(Sale("  ", "  "));   // blanks count as absent

        var call = Assert.Single(registrar.Calls);
        Assert.Equal(AnonymousCounterCustomer.NormalisedMobile, call.Mobile);
        Assert.Equal(AnonymousCounterCustomer.FullName, call.Name);
    }

    [Fact]
    public async Task IfTheSystemAccountCannotBeResolved_TheSaleIsRefused_WithTheRegistrarsReason()
    {
        var registrar = new Registrar(CounterBuyerResolution.Refused(BusinessViolationCodes.AccountNotActive, OrderMessages.CounterMobileHeldByInactiveAccount, "CustomerMobile"));
        var loader = new Loader();

        var response = await Handler(new Finder(null), registrar, loader).HandleAsync(Sale());

        Assert.Equal([BusinessViolationCodes.AccountNotActive], Codes(response));
        Assert.False(loader.Loaded);
    }

    [Fact]
    public async Task ACashierCannotNameTheReservedNumberAsABuyer()
    {
        var registrar = new Registrar(CounterBuyerResolution.Refused("X", "x", "x"));
        var finder = new Finder(null);

        foreach (var typed in new[] { "01000000000", "+880 1000-000000", "8801000000000" })
        {
            var response = await Handler(finder, registrar, new Loader()).HandleAsync(Sale("Somebody", typed));
            Assert.Equal([BusinessViolationCodes.InvalidMobileNumber], Codes(response));
        }

        Assert.Empty(finder.Looked);
        Assert.Empty(registrar.Calls);
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(null, true)]
    public async Task AnAnonymousSale_RefusesACodeThatIsLimitedPerCustomerOrToAFirstOrder(int? perCustomerLimit, bool firstOrderOnly)
    {
        var system = new CustomerContactFacts(Guid.NewGuid(), AnonymousCounterCustomer.FullName, AnonymousCounterCustomer.NormalisedMobile, IsActive: true);

        var response = await Handler(new Finder(system), new Registrar(CounterBuyerResolution.Found(system)), new Loader(Code(perCustomerLimit, firstOrderOnly))).HandleAsync(Sale(code: "SAVE10"));

        Assert.Equal([BusinessViolationCodes.DiscountCustomerLimitReached], Codes(response));
    }

    [Fact]
    public async Task AnAnonymousSale_AcceptsAnOrdinaryCode_AndANamedSaleStillMeetsTheLimitedOne()
    {
        var system = new CustomerContactFacts(Guid.NewGuid(), AnonymousCounterCustomer.FullName, AnonymousCounterCustomer.NormalisedMobile, IsActive: true);
        var rina = new CustomerContactFacts(Guid.NewGuid(), "Rina Akter", "+8801712345678", IsActive: true);

        // an ordinary code passes the new guard (the sale is then refused only because the fake has nothing to sell)
        var ordinary = await Handler(new Finder(system), new Registrar(CounterBuyerResolution.Found(system)), new Loader(Code())).HandleAsync(Sale(code: "SAVE10"));
        Assert.DoesNotContain(BusinessViolationCodes.DiscountCustomerLimitReached, Codes(ordinary));

        // a named buyer is not subject to the anonymous guard
        var named = await Handler(new Finder(rina), new Registrar(CounterBuyerResolution.Found(rina)), new Loader(Code(perCustomerLimit: 1))).HandleAsync(Sale("Rina Akter", "01712345678", "SAVE10"));
        Assert.DoesNotContain(BusinessViolationCodes.DiscountCustomerLimitReached, Codes(named));
    }

    [Fact]
    public async Task ANamedSale_StillPricesForItsCustomer()
    {
        var rina = new CustomerContactFacts(Guid.NewGuid(), "Rina Akter", "+8801712345678", IsActive: true);
        var loader = new Loader();

        await Handler(new Finder(rina), new Registrar(CounterBuyerResolution.Found(rina)), loader).HandleAsync(Sale("Rina Akter", "01712345678"));

        Assert.Equal(rina.CustomerId, loader.CustomerIdSeen);
    }
}
