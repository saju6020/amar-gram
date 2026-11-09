using AmarGram.Application.CommandHandlers.Billing;
using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Billing;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Billing;

/// <summary>HO-BIL-001 §15 group B (U-B1) at the handler level -- manual charges and voids.</summary>
public sealed class ChargeCommandHandlerTests
{
    private static readonly DateOnly ServiceDate = new(2026, 10, 7);

    private readonly FakeAggregateRootRepository<CustomerAccountAggregate> _customers = new();
    private readonly FakeAggregateRootRepository<ChargeAggregate> _charges = new();
    private readonly FakeBillingPricingInputs _pricing = new();
    private readonly FakeBillingFinder _finder = new();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 7, 6, 0, 0, TimeSpan.Zero));
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _taxClassId = Guid.NewGuid();

    public ChargeCommandHandlerTests() => _pricing.AddTaxClass(_taxClassId);

    private Guid SeedCustomer(bool merged = false)
    {
        var customer = new CustomerAccountAggregate(Guid.NewGuid());
        customer.RegisterWalkIn(new WalkInCustomerRegistrationDto("Jane", MobileNumber.Create("0171" + Random.Shared.NextInt64(1_000_000, 9_999_999)), TestUserContext.Create(), Guid.NewGuid()));
        _customers.Seed(customer);
        return customer.Id;
    }

    private RecordManualChargeCommandHandler ManualHandler() => new(_customers, _charges, _pricing, BillingTestSettings.Defaults(), _time);

    private RecordManualChargeCommand Fee(Guid customerId, decimal price = 250m, decimal quantity = 2m, decimal discount = 0m, string? line = null) => new()
    {
        ChargeId = Guid.NewGuid(), CustomerId = customerId, BranchId = _branchId, Description = "Late pickup fee", UnitPrice = price,
        TaxClassId = _taxClassId, Quantity = quantity, LineDiscount = discount, ServiceDate = ServiceDate, BusinessLine = line,
        UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
    };

    // ── C2 ──────────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task C2_AFreeTextFee_IsRecordedAsAFeeLine_AtTheEnteredPrice()
    {
        var customerId = SeedCustomer();

        var response = await ManualHandler().HandleAsync(Fee(customerId));

        Assert.True(response.IsSuccess);
        var charge = Assert.Single(_charges.Saved);
        Assert.Equal(ItemKind.Fee, charge.ItemKind);
        Assert.Equal(ChargeSourceKind.Manual, charge.SourceKind);
        Assert.Equal(charge.Id, charge.SourceId);
        Assert.Equal(BusinessLine.Shop, charge.BusinessLine);
        Assert.Equal(250m, charge.UnitPriceAmount);
        Assert.Equal(_branchId, charge.BranchId);
    }

    [Fact]
    public async Task C2_AnUnknownCustomer_AnUnknownTaxClass_AndABadQuantity_AreReturnedNotThrown()
    {
        var customerId = SeedCustomer();

        var noCustomer = await ManualHandler().HandleAsync(Fee(Guid.NewGuid()));
        Assert.Equal(BusinessViolationCodes.CustomerNotFound, noCustomer.ValidationResult!.Errors.Single().ErrorCode);

        _pricing.TaxClasses.Clear();
        var missingClass = await ManualHandler().HandleAsync(Fee(customerId));
        Assert.Equal(BusinessViolationCodes.TaxClassNotFound, missingClass.ValidationResult!.Errors.Single().ErrorCode);

        _pricing.AddTaxClass(_taxClassId);
        var badQuantity = await ManualHandler().HandleAsync(Fee(customerId, quantity: 0.0001m));
        Assert.Equal(BusinessViolationCodes.InvalidQuantity, badQuantity.ValidationResult!.Errors.Single().ErrorCode);
    }

    [Fact]
    public async Task C2_OnlyAManualChargeMayChooseItsBusinessLine()
    {
        var customerId = SeedCustomer();

        var response = await ManualHandler().HandleAsync(Fee(customerId, line: "Shop"));

        Assert.True(response.IsSuccess);
        Assert.Equal(BusinessLine.Shop, _charges.Saved.Single().BusinessLine);
    }

    [Fact]
    public void C2_TheValidator_RequiresTheFeeFields_AndBoundsTheShape()
    {
        var validator = new RecordManualChargeCommandValidator(_time);
        var ok = Fee(Guid.NewGuid());
        Assert.True(validator.Validate(ok).IsValid);

        Assert.False(validator.Validate(Fee(Guid.NewGuid(), price: -1m)).IsValid);
        Assert.False(validator.Validate(Fee(Guid.NewGuid(), price: 10.005m)).IsValid);
        Assert.False(validator.Validate(Fee(Guid.NewGuid(), quantity: 0m)).IsValid);
        Assert.False(validator.Validate(Fee(Guid.NewGuid(), quantity: 1.0001m)).IsValid);
        Assert.False(validator.Validate(Fee(Guid.NewGuid(), line: "Nowhere")).IsValid);

        var neither = new RecordManualChargeCommand
        {
            ChargeId = Guid.NewGuid(), CustomerId = Guid.NewGuid(), BranchId = _branchId, Quantity = 1m, ServiceDate = ServiceDate,
            UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
        };
        Assert.False(validator.Validate(neither).IsValid);
    }

    // ── C3 ──────────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task C3_VoidingAnotherBranchsCharge_IsNotFound_AndAnActiveOneIsVoidedWithItsReason()
    {
        var customerId = SeedCustomer();
        await ManualHandler().HandleAsync(Fee(customerId));
        var charge = _charges.Saved.Single();
        var handler = new VoidChargeCommandHandler(_finder, _charges, _time);

        var elsewhere = await handler.HandleAsync(new VoidChargeCommand { ChargeId = charge.Id, BranchId = Guid.NewGuid(), Reason = "x", UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() });
        Assert.Equal(BusinessViolationCodes.ChargeNotFound, elsewhere.ValidationResult!.Errors.Single().ErrorCode);
        Assert.Equal(ChargeStatus.Active, charge.Status);

        var voided = await handler.HandleAsync(new VoidChargeCommand { ChargeId = charge.Id, BranchId = _branchId, Reason = "Entered twice", UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() });
        Assert.True(voided.IsSuccess);
        Assert.Equal(ChargeStatus.Voided, charge.Status);

        var again = await handler.HandleAsync(new VoidChargeCommand { ChargeId = charge.Id, BranchId = _branchId, Reason = "Again", UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() });
        Assert.Equal(BusinessViolationCodes.ChargeNotActive, again.ValidationResult!.Errors.Single().ErrorCode);
    }
}
