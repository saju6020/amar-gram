using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using static AmarGram.Domain.Tests.Subscriptions.SubscriptionTestSupport;

namespace AmarGram.Domain.Tests.Subscriptions;

/// <summary>HO-SUB-001 §15 B -- creating a subscription (US-SUB-01 AC1) and the status machine (Appendix C, §8.4).</summary>
public sealed class SubscriptionLifecycleTests
{
    private static string Code(Action act) => Assert.Throws<DomainRuleViolationException>(act).ErrorCode;

    private static CreateSubscriptionDto Dto(DateOnly? first, SubscriptionClock? clock = null) =>
        new(Customer, Sku, "Red lentils", "1 kg", Terms(), first, clock ?? Clock(Oct1), User, Guid.NewGuid());

    // ── create ───────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void U_B1_Create_WithNoFirstDate_StartsOnTheEarliestDelivery()
    {
        var subscription = Active();

        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal(D(10, 4), subscription.StartedOn);
        Assert.Equal(D(10, 4), subscription.NextDeliveryOn);
        Assert.Equal(D(10, 1), subscription.NextDeliverySetOn);
        Assert.Equal(Customer, subscription.CustomerId);
        Assert.Equal("Red lentils", subscription.Product.ProductName);
        var created = Assert.Single(subscription.Events.OfType<SubscriptionCreatedEvent>());
        Assert.Equal(D(10, 4), created.NextDeliveryOn);
        Assert.Equal(SubscriptionPaymentMethod.CashOnDelivery.Value, created.PaymentMethod);
    }

    [Theory]
    [InlineData(10, 3)]   // Today + cut-off: its own cut-off has already passed
    [InlineData(12, 31)]  // Today + 91
    public void U_B2_Create_WithAFirstDateOutsideTheWindow_IsRefused(int month, int day)
    {
        var subscription = new SubscriptionAggregate(Guid.NewGuid());
        Assert.Equal(BusinessViolationCodes.InvalidFirstDeliveryDate, Code(() => subscription.Create(Dto(D(month, day)))));
    }

    [Theory]
    [InlineData(10, 4)]   // the earliest
    [InlineData(12, 30)]  // Today + 90, the horizon
    public void U_B2b_Create_AtTheEdgesOfTheWindow_IsAccepted(int month, int day)
    {
        var subscription = new SubscriptionAggregate(Guid.NewGuid());
        subscription.Create(Dto(D(month, day)));
        Assert.Equal(D(month, day), subscription.NextDeliveryOn);
    }

    [Fact]
    public void U_B3_TheTerms_RefuseEachInvalidCombination_WithTheSpecificCode()
    {
        var delivery = SubscriptionFulfilment.Delivery;
        var pickup = SubscriptionFulfilment.Pickup;
        var branch = Guid.NewGuid();
        var cod = SubscriptionPaymentMethod.CashOnDelivery;

        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionQuantity, Code(() => SubscriptionTerms.Create(0, 4, delivery, Address, null, cod)));
        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionQuantity, Code(() => SubscriptionTerms.Create(21, 4, delivery, Address, null, cod)));
        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionInterval, Code(() => SubscriptionTerms.Create(1, 3, delivery, Address, null, cod)));
        Assert.Equal(BusinessViolationCodes.PaymentMethodNotAllowedForFulfilment, Code(() => SubscriptionTerms.Create(1, 4, pickup, null, branch, cod)));
        Assert.Equal(BusinessViolationCodes.PaymentMethodNotAllowedForFulfilment, Code(() => SubscriptionTerms.Create(1, 4, delivery, Address, null, SubscriptionPaymentMethod.PayAtPickup)));
        Assert.Equal(BusinessViolationCodes.FulfilmentDetailsInvalid, Code(() => SubscriptionTerms.Create(1, 4, delivery, null, null, cod)));
        Assert.Equal(BusinessViolationCodes.FulfilmentDetailsInvalid, Code(() => SubscriptionTerms.Create(1, 4, delivery, Address, branch, cod)));
        Assert.Equal(BusinessViolationCodes.FulfilmentDetailsInvalid, Code(() => SubscriptionTerms.Create(1, 4, pickup, null, null, SubscriptionPaymentMethod.PayAtPickup)));
        Assert.Equal(BusinessViolationCodes.FulfilmentDetailsInvalid, Code(() => SubscriptionTerms.Create(1, 4, pickup, Address, branch, SubscriptionPaymentMethod.PayAtPickup)));
    }

    [Fact]
    public void U_B3b_TheTerms_AcceptEveryAllowedInterval_AndBankTransferWithEitherFulfilment()
    {
        foreach (var weeks in SubscriptionRules.AllowedIntervalWeeks)
            Assert.Equal(weeks, SubscriptionTerms.Create(1, weeks, SubscriptionFulfilment.Delivery, Address, null, SubscriptionPaymentMethod.BankTransfer).IntervalWeeks);

        SubscriptionTerms.Create(1, 4, SubscriptionFulfilment.Pickup, null, Guid.NewGuid(), SubscriptionPaymentMethod.BankTransfer);
        SubscriptionTerms.Create(SubscriptionRules.MaxQuantity, 4, SubscriptionFulfilment.Pickup, null, Guid.NewGuid(), SubscriptionPaymentMethod.PayAtPickup);
    }

    // ── the status machine ───────────────────────────────────────────────────────────────────────

    private static SubscriptionAggregate InState(string status) => status switch
    {
        "Active" => Active(),
        "Paused" => Paused(),
        "Suspended" => Suspended(),
        _ => Cancelled(),
    };

    private static SubscriptionAggregate Paused()
    {
        var s = Active();
        s.Pause(Clock(Oct1), User, Guid.NewGuid());
        return s;
    }

    private static SubscriptionAggregate Suspended(SubscriptionSuspensionReason? reason = null)
    {
        var s = Active();
        s.Suspend(reason ?? SubscriptionSuspensionReason.UnpaidCycles, Oct1, User, Guid.NewGuid());
        return s;
    }

    private static SubscriptionAggregate Cancelled()
    {
        var s = Active();
        s.Cancel(Customer, SubscriptionCancellationReason.Other, null, Clock(Oct1), User, Guid.NewGuid());
        return s;
    }

    private static void Perform(SubscriptionAggregate s, string action)
    {
        var clock = Clock(Oct1);
        switch (action)
        {
            case "Pause": s.Pause(clock, User, Guid.NewGuid()); break;
            case "Resume": s.Resume(null, clock, User, Guid.NewGuid()); break;
            case "Skip": s.SkipDelivery(D(10, 4), clock, User, Guid.NewGuid()); break;
            case "ChangeTerms": s.ChangeTerms(Terms(quantity: 9), clock, User, Guid.NewGuid()); break;
            case "Cancel": s.Cancel(Customer, SubscriptionCancellationReason.Other, null, clock, User, Guid.NewGuid()); break;
            case "Suspend": s.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, User, Guid.NewGuid()); break;
            case "Reinstate": s.Reinstate(Guid.NewGuid(), "Customer paid by transfer", null, clock, User, Guid.NewGuid()); break;
            default: throw new ArgumentOutOfRangeException(nameof(action));
        }
    }

    /// <summary>§8.4 over every (status, action) pair: only the listed arrows succeed; every other pair is refused with its specific code and a message naming the state.</summary>
    [Theory]
    // Active
    [InlineData("Active", "Pause", null)]
    [InlineData("Active", "Skip", null)]
    [InlineData("Active", "ChangeTerms", null)]
    [InlineData("Active", "Cancel", null)]
    [InlineData("Active", "Suspend", null)]
    [InlineData("Active", "Resume", "InvalidSubscriptionTransition")]
    [InlineData("Active", "Reinstate", "SubscriptionCannotBeReinstated")]
    // Paused
    [InlineData("Paused", "Resume", null)]
    [InlineData("Paused", "ChangeTerms", null)]
    [InlineData("Paused", "Cancel", null)]
    [InlineData("Paused", "Suspend", null)]
    [InlineData("Paused", "Pause", "InvalidSubscriptionTransition")]
    [InlineData("Paused", "Skip", "InvalidSubscriptionTransition")]
    [InlineData("Paused", "Reinstate", "SubscriptionCannotBeReinstated")]
    // Suspended
    [InlineData("Suspended", "Cancel", null)]
    [InlineData("Suspended", "Suspend", null)]
    [InlineData("Suspended", "Reinstate", null)]
    [InlineData("Suspended", "Resume", "SubscriptionSuspended")]
    [InlineData("Suspended", "Pause", "InvalidSubscriptionTransition")]
    [InlineData("Suspended", "Skip", "InvalidSubscriptionTransition")]
    [InlineData("Suspended", "ChangeTerms", "InvalidSubscriptionTransition")]
    // Cancelled (terminal)
    [InlineData("Cancelled", "Pause", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "Resume", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "Skip", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "ChangeTerms", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "Cancel", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "Suspend", "InvalidSubscriptionTransition")]
    [InlineData("Cancelled", "Reinstate", "SubscriptionCannotBeReinstated")]
    public void U_B4_EveryStatusAndAction_FollowsTheStatusMachine(string status, string action, string? expectedCode)
    {
        var subscription = InState(status);

        if (expectedCode is null)
        {
            Perform(subscription, action);
            return;
        }

        var ex = Assert.Throws<DomainRuleViolationException>(() => Perform(subscription, action));
        Assert.Equal(expectedCode, ex.ErrorCode);
        if (expectedCode == BusinessViolationCodes.InvalidSubscriptionTransition)
            Assert.Contains(status.ToLowerInvariant(), ex.Message);   // "A cancelled subscription cannot be paused."
    }

    [Fact]
    public void U_B4b_ACancelledSubscription_CannotBeWithdrawnOrChanged_AndTheMessageNamesTheState()
    {
        var cancelled = Cancelled();
        var ex = Assert.Throws<DomainRuleViolationException>(() => cancelled.Pause(Clock(Oct1), User, Guid.NewGuid()));
        Assert.Equal("A cancelled subscription cannot be paused.", ex.Message);
        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionTransition, Code(() => cancelled.WithdrawPendingChanges(Clock(Oct1), User, Guid.NewGuid())));
    }

    [Fact]
    public void U_B5_ACustomerCannotResumeASuspension()
    {
        var subscription = Suspended();
        var ex = Assert.Throws<DomainRuleViolationException>(() => subscription.Resume(null, Clock(Oct1), User, Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.SubscriptionSuspended, ex.ErrorCode);
        Assert.Equal(SubscriptionStatus.Suspended, subscription.Status);
    }

    [Fact]
    public void U_B6_Suspending_IsIdempotent_NoSecondEvent_NoVersionBump()
    {
        var subscription = Active();
        Assert.True(subscription.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, User, Guid.NewGuid()));
        var version = subscription.Version;
        var events = subscription.Events.Count;

        Assert.False(subscription.Suspend(SubscriptionSuspensionReason.ProductUnavailable, Oct1, User, Guid.NewGuid()));

        Assert.Equal(version, subscription.Version);
        Assert.Equal(events, subscription.Events.Count);
        Assert.Equal(SubscriptionSuspensionReason.UnpaidCycles, subscription.SuspensionReason);   // the first reason stands
        Assert.Null(subscription.NextDeliveryOn);
    }

    [Fact]
    public void Suspending_ClearsEveryScheduledChange()
    {
        var subscription = Active();
        subscription.ChangeTerms(Terms(quantity: 4), Clock(Oct1Locked), User, Guid.NewGuid());
        subscription.SkipDelivery(D(11, 1), Clock(Oct1Locked), User, Guid.NewGuid());

        subscription.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, User, Guid.NewGuid());

        Assert.Null(subscription.PendingTerms);
        Assert.False(subscription.PendingSkip);
        Assert.Null(subscription.PendingStatusChange);
        Assert.NotNull(subscription.SuspendedOn);
    }

    [Fact]
    public void U_B7_Reinstate_NeedsAReason_AndOnlyAppliesToASuspension()
    {
        var blank = Suspended();
        Assert.Equal(BusinessViolationCodes.ReinstatementReasonRequired, Code(() => blank.Reinstate(Guid.NewGuid(), "  ", null, Clock(Oct1), User, Guid.NewGuid())));
        Assert.Equal(SubscriptionStatus.Suspended, blank.Status);

        var staff = Guid.NewGuid();
        var subscription = Suspended();
        subscription.Reinstate(staff, " Paid by transfer ", null, Clock(Oct1), User, Guid.NewGuid());

        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Null(subscription.SuspensionReason);
        Assert.Equal(D(10, 4), subscription.NextDeliveryOn);
        Assert.Equal(D(10, 1), subscription.NextDeliverySetOn);
        Assert.Equal(staff, subscription.ReinstatedBy);
        Assert.Equal("Paid by transfer", subscription.ReinstatementReason);
        Assert.Contains(subscription.Events, e => e is SubscriptionReinstatedEvent);
    }

    [Fact]
    public void U_B7b_Reinstate_ValidatesTheRestartDate()
    {
        var subscription = Suspended();
        Assert.Equal(BusinessViolationCodes.InvalidFirstDeliveryDate, Code(() => subscription.Reinstate(Guid.NewGuid(), "ok", D(10, 2), Clock(Oct1), User, Guid.NewGuid())));
    }

    [Fact]
    public void U_B8_ASuspension_CanNeitherBeResumedNorPausedByTheCustomer()
    {
        var subscription = Suspended(SubscriptionSuspensionReason.ProductUnavailable);
        Assert.Equal(BusinessViolationCodes.SubscriptionSuspended, Code(() => subscription.Resume(null, Clock(Oct1), User, Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionTransition, Code(() => subscription.Pause(Clock(Oct1), User, Guid.NewGuid())));
    }

    // ── merge and deletion (ADR-247) ─────────────────────────────────────────────────────────────

    [Fact]
    public void AMerge_ReassignsTheSubscriptionToTheSurvivor_Idempotently()
    {
        var survivor = Guid.NewGuid();
        var subscription = Active();

        Assert.True(subscription.ReassignCustomerOnMerge(survivor, User, Guid.NewGuid()));
        var version = subscription.Version;
        Assert.False(subscription.ReassignCustomerOnMerge(survivor, User, Guid.NewGuid()));

        Assert.Equal(survivor, subscription.CustomerId);
        Assert.Equal(version, subscription.Version);
        Assert.Single(subscription.Events.OfType<SubscriptionCustomerReassignedEvent>());
    }

    [Fact]
    public void AMergeDuplicate_IsCancelledWithTheMergeReason_Idempotently_AndKeepsNoNote()
    {
        var subscription = Active();

        Assert.True(subscription.CancelAsMergeDuplicate(Oct1, User, Guid.NewGuid()));
        Assert.False(subscription.CancelAsMergeDuplicate(Oct1, User, Guid.NewGuid()));

        Assert.Equal(SubscriptionStatus.Cancelled, subscription.Status);
        Assert.Equal(SubscriptionCancellationReason.CustomerMerged, subscription.CancellationReason);
        Assert.Null(subscription.NextDeliveryOn);
    }

    [Fact]
    public void AccountDeletion_CancelsAnyLiveSubscription_AndClearsTheFreeTextNote()
    {
        var live = Active();
        Assert.True(live.CancelOnAccountDeletion(Oct1, User, Guid.NewGuid()));
        Assert.Equal(SubscriptionCancellationReason.AccountDeleted, live.CancellationReason);

        var cancelledWithNote = Active();
        cancelledWithNote.Cancel(Customer, SubscriptionCancellationReason.Other, "private words", Clock(Oct1), User, Guid.NewGuid());
        Assert.False(cancelledWithNote.CancelOnAccountDeletion(Oct1, User, Guid.NewGuid()));   // already cancelled: not re-cancelled...
        Assert.Null(cancelledWithNote.CancellationNote);                                       // ...but the note is erased

        Assert.False(cancelledWithNote.CancelOnAccountDeletion(Oct1, User, Guid.NewGuid()));   // and a re-send changes nothing
    }

    [Fact]
    public void ACancellationNote_OverTheLimit_IsRefused()
    {
        var subscription = Active();
        Assert.Throws<DomainRuleViolationException>(() => subscription.Cancel(
            Customer, SubscriptionCancellationReason.Other, new string('x', SubscriptionRules.MaxNoteLength + 1), Clock(Oct1), User, Guid.NewGuid()));
    }
}
