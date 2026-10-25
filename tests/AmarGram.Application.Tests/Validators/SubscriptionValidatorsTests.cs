using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.Tests.Validators;

/// <summary>HO-SUB-001 §11.2 -- SHAPE only: ids, quantity and interval ranges, fulfilment and its id consistent, text lengths and the cancel / reinstate reasons. Date windows (earliest,
/// cut-off, horizon) are the aggregate's, because they need the commerce clock.</summary>
public sealed class SubscriptionValidatorsTests
{
    private static readonly Guid Id = Guid.NewGuid();

    private static CreateSubscriptionCommand Create(
        int quantity = 2, int interval = 4, Guid? address = null, Guid? branch = null, SubscriptionFulfilment? fulfilment = null) => new()
    {
        SubscriptionId = Id, SkuId = Id, Quantity = quantity, IntervalWeeks = interval, Fulfilment = fulfilment ?? SubscriptionFulfilment.Delivery,
        DeliveryAddressId = address ?? (fulfilment == SubscriptionFulfilment.Pickup ? null : Id), PickupBranchId = branch, PaymentMethod = SubscriptionPaymentMethod.CashOnDelivery,
        UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public void Create_AValidDeliveryAndAValidPickup_Pass()
    {
        var validator = new CreateSubscriptionCommandValidator();

        Assert.True(validator.Validate(Create()).IsValid);
        Assert.True(validator.Validate(Create(fulfilment: SubscriptionFulfilment.Pickup, branch: Id)).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    [InlineData(-1)]
    public void Create_QuantityOutsideOneToTwenty_FailsOnQuantity(int quantity) =>
        Assert.Contains(new CreateSubscriptionCommandValidator().Validate(Create(quantity: quantity)).Errors, e => e.PropertyName == nameof(CreateSubscriptionCommand.Quantity));

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(10)]
    [InlineData(52)]
    public void Create_AnIntervalOutsideTheAllowedSet_FailsOnIntervalWeeks(int interval) =>
        Assert.Contains(new CreateSubscriptionCommandValidator().Validate(Create(interval: interval)).Errors, e => e.PropertyName == nameof(CreateSubscriptionCommand.IntervalWeeks));

    [Fact]
    public void Create_EveryAllowedInterval_Passes() =>
        Assert.All(SubscriptionRules.AllowedIntervalWeeks, weeks => Assert.True(new CreateSubscriptionCommandValidator().Validate(Create(interval: weeks)).IsValid));

    [Fact]
    public void Create_ADeliveryWithoutAnAddress_OrWithABranchToo_AndAPickupWithoutABranch_FailOnFulfilment()
    {
        var validator = new CreateSubscriptionCommandValidator();

        Assert.False(validator.Validate(Create(address: Guid.Empty)).IsValid);
        Assert.False(validator.Validate(Create(branch: Id)).IsValid);                                                                  // delivery with a branch too
        Assert.False(validator.Validate(Create(fulfilment: SubscriptionFulfilment.Pickup)).IsValid);                                   // pickup with no branch
        Assert.False(validator.Validate(Create(fulfilment: SubscriptionFulfilment.Pickup, branch: Id, address: Id)).IsValid);          // pickup with an address too
    }

    [Fact]
    public void Create_EmptyIds_Fail()
    {
        var result = new CreateSubscriptionCommandValidator().Validate(new CreateSubscriptionCommand
        {
            SubscriptionId = Guid.Empty, SkuId = Guid.Empty, Quantity = 1, IntervalWeeks = 4, Fulfilment = SubscriptionFulfilment.Delivery, DeliveryAddressId = Id,
            PaymentMethod = SubscriptionPaymentMethod.CashOnDelivery, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
        });

        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateSubscriptionCommand.SubscriptionId));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateSubscriptionCommand.SkuId));
    }

    [Fact]
    public void ChangeTerms_AppliesTheSameShapeRules()
    {
        ChangeSubscriptionTermsCommand Change(int quantity, int interval, Guid? address) => new()
        {
            SubscriptionId = Id, ExpectedVersion = 3, Quantity = quantity, IntervalWeeks = interval, Fulfilment = SubscriptionFulfilment.Delivery, DeliveryAddressId = address,
            PaymentMethod = SubscriptionPaymentMethod.BankTransfer, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
        };

        var validator = new ChangeSubscriptionTermsCommandValidator();
        Assert.True(validator.Validate(Change(3, 8, Id)).IsValid);
        Assert.False(validator.Validate(Change(0, 8, Id)).IsValid);
        Assert.False(validator.Validate(Change(3, 5, Id)).IsValid);
        Assert.False(validator.Validate(Change(3, 8, null)).IsValid);
    }

    // ── cancel: a customer chooses a customer reason; staff must say StaffCancelled and why ──────

    private static CancelSubscriptionCommand Cancel(SubscriptionCancellationReason reason, string? note = null, bool byStaff = false) => new()
    {
        SubscriptionId = Id, Reason = reason, Note = note, ByStaff = byStaff, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public void Cancel_ACustomerMayChooseOnlyACustomerReason()
    {
        var validator = new CancelSubscriptionCommandValidator();

        Assert.All(Enumeration.GetAll<SubscriptionCancellationReason>().Where(r => r.IsCustomerChoice), r => Assert.True(validator.Validate(Cancel(r)).IsValid));
        Assert.All(
            new[] { SubscriptionCancellationReason.StaffCancelled, SubscriptionCancellationReason.CustomerMerged, SubscriptionCancellationReason.AccountDeleted },
            r => Assert.False(validator.Validate(Cancel(r)).IsValid));
    }

    [Fact]
    public void Cancel_AStaffCancellation_NeedsStaffCancelledAndANote_WithTheSpecificCode()
    {
        var validator = new CancelSubscriptionCommandValidator();

        Assert.True(validator.Validate(Cancel(SubscriptionCancellationReason.StaffCancelled, "Customer rang", byStaff: true)).IsValid);

        var noNote = validator.Validate(Cancel(SubscriptionCancellationReason.StaffCancelled, null, byStaff: true));
        Assert.Contains(noNote.Errors, e => e.ErrorCode == BusinessViolationCodes.CancellationReasonRequired);

        var wrongReason = validator.Validate(Cancel(SubscriptionCancellationReason.TooExpensive, "note", byStaff: true));
        Assert.Contains(wrongReason.Errors, e => e.ErrorCode == BusinessViolationCodes.CancellationReasonRequired);
    }

    [Fact]
    public void Cancel_ANoteOverFiveHundredCharacters_Fails() =>
        Assert.Contains(
            new CancelSubscriptionCommandValidator().Validate(Cancel(SubscriptionCancellationReason.Other, new string('x', SubscriptionRules.MaxNoteLength + 1))).Errors,
            e => e.PropertyName == nameof(CancelSubscriptionCommand.Note));

    // ── C8 and C11 ───────────────────────────────────────────────────────────────────────────────

    private static RecordSubscriptionCycleCommand Record(Guid? orderId, string? number, string? status, string? failure, decimal discount = 0m) => new()
    {
        SubscriptionCycleId = Id, SubscriptionId = Id, CycleOn = new DateOnly(2026, 10, 4), IdempotencyKey = "sub:key", DiscountPercent = discount,
        OrderId = orderId, OrderNumber = number, OrderStatus = status, FailureCode = failure, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public void RecordCycle_IsEitherGeneratedOrFailed_NeverBoth_NeverNeither()
    {
        var validator = new RecordSubscriptionCycleCommandValidator();

        Assert.True(validator.Validate(Record(Id, "ORD-1", "Confirmed", null)).IsValid);
        Assert.True(validator.Validate(Record(null, null, null, "StockNoLongerAvailable")).IsValid);
        Assert.False(validator.Validate(Record(Id, "ORD-1", "Confirmed", "SomeCode")).IsValid);
        Assert.False(validator.Validate(Record(null, null, null, null)).IsValid);
        Assert.False(validator.Validate(Record(Id, null, "Confirmed", null)).IsValid);            // an order with no number
        Assert.False(validator.Validate(Record(Id, "ORD-1", "Confirmed", null, discount: 101m)).IsValid);
    }

    [Fact]
    public void Reinstate_NeedsAReason_AtMostFiveHundredCharacters()
    {
        ReinstateSubscriptionCommand Reinstate(string reason) =>
            new() { SubscriptionId = Id, Reason = reason, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() };

        var validator = new ReinstateSubscriptionCommandValidator();
        Assert.True(validator.Validate(Reinstate("Paid by transfer")).IsValid);
        Assert.Contains(validator.Validate(Reinstate("")).Errors, e => e.ErrorCode == BusinessViolationCodes.ReinstatementReasonRequired);
        Assert.False(validator.Validate(Reinstate(new string('x', 501))).IsValid);
    }

    [Fact]
    public void TheSimpleCommands_NeedASubscriptionId()
    {
        Assert.False(new PauseSubscriptionCommandValidator().Validate(new PauseSubscriptionCommand { SubscriptionId = Guid.Empty, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new SkipSubscriptionDeliveryCommandValidator().Validate(new SkipSubscriptionDeliveryCommand
        { SubscriptionId = Guid.Empty, CycleOn = new DateOnly(2026, 10, 4), UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new ResumeSubscriptionCommandValidator().Validate(new ResumeSubscriptionCommand { SubscriptionId = Guid.Empty, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new WithdrawPendingSubscriptionChangesCommandValidator().Validate(new WithdrawPendingSubscriptionChangesCommand
        { SubscriptionId = Guid.Empty, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new SuspendSubscriptionCommandValidator().Validate(new SuspendSubscriptionCommand
        { SubscriptionId = Guid.Empty, Reason = SubscriptionSuspensionReason.UnpaidCycles, UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid() }).IsValid);
    }

    [Fact]
    public void EveryValidator_IsAnIValidatorOfItsCommand_SoTheRegistrationConventionResolvesIt()
    {
        var validators = typeof(CreateSubscriptionCommandValidator).Assembly.GetTypes()
            .Where(t => t.Namespace == typeof(CreateSubscriptionCommandValidator).Namespace && t.Name.EndsWith("SubscriptionCommandValidator", StringComparison.Ordinal)
                        || t.Name is "WithdrawPendingSubscriptionChangesCommandValidator" or "SkipSubscriptionDeliveryCommandValidator" or "RecordSubscriptionCycleCommandValidator")
            .ToList();

        Assert.NotEmpty(validators);
        Assert.All(validators, t => Assert.Contains(t.GetInterfaces(), i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IValidator<>)));
    }
}
