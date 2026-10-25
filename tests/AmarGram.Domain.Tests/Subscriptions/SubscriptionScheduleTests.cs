using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using static AmarGram.Domain.Tests.Subscriptions.SubscriptionTestSupport;

namespace AmarGram.Domain.Tests.Subscriptions;

/// <summary>HO-SUB-001 §15 A and C -- the clock, the estimate, and what a change does before and after the cut-off (US-SUB-02 AC1 and AC2). Time is the Dhaka commerce zone (UTC+6).</summary>
public sealed class SubscriptionScheduleTests
{
    private static string Code(Action act) => Assert.Throws<DomainRuleViolationException>(act).ErrorCode;

    private static readonly DateTimeOffset Sep22 = new(2026, 9, 22, 6, 0, 0, TimeSpan.Zero);

    // ── A: the clock ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void U_A1_TheCutoff_IsLocalMidnight_CutoffDaysBeforeTheCycle()
    {
        var before = Clock(new DateTimeOffset(2026, 10, 17, 17, 30, 0, TimeSpan.Zero));   // 23:30 on the 17th in Dhaka
        var cycle = D(10, 20);

        Assert.Equal(D(10, 17), before.Today);
        Assert.Equal(new DateTimeOffset(2026, 10, 18, 0, 0, 0, TimeSpan.FromHours(6)), before.CutoffInstant(cycle));
        Assert.False(before.IsLocked(cycle));
        Assert.True(Clock(new DateTimeOffset(2026, 10, 17, 18, 0, 0, TimeSpan.Zero)).IsLocked(cycle));
    }

    [Fact]
    public void U_A2_TheEarliestDelivery_IsTodayPlusCutoffPlusOne()
    {
        Assert.Equal(Clock(Oct1, cutoffDays: 0).Today.AddDays(1), Clock(Oct1, cutoffDays: 0).EarliestDeliveryOn);
        Assert.Equal(Clock(Oct1, cutoffDays: 2).Today.AddDays(3), Clock(Oct1, cutoffDays: 2).EarliestDeliveryOn);
    }

    [Fact]
    public void U_A3_TheNoticeDate_IsNeverLaterThanTheDayBeforeTheCutoff()
    {
        Assert.Equal(D(10, 17), SubscriptionSchedule.NoticeDateFor(D(10, 20), noticeDays: 3, cutoffDays: 2));
        Assert.Equal(D(10, 17), SubscriptionSchedule.NoticeDateFor(D(10, 20), noticeDays: 1, cutoffDays: 2)); // floored at cut-off + 1
        Assert.Equal(D(10, 13), SubscriptionSchedule.NoticeDateFor(D(10, 20), noticeDays: 7, cutoffDays: 2));
    }

    [Fact]
    public void U_A4_Describe_NamesTheDateTheChangeTakesEffect()
    {
        var immediate = Active().ChangeTerms(Terms(quantity: 3), Clock(Oct1), User, Guid.NewGuid());
        Assert.Equal("Done. Your next delivery on Sun 4 Oct will be 3 × Red lentils 1 kg.", immediate.Message);

        var scheduled = Active().ChangeTerms(Terms(quantity: 3), Clock(Oct1Locked), User, Guid.NewGuid());
        Assert.Equal("Your delivery on Sun 4 Oct is already being prepared, so this change starts with the delivery on Sun 1 Nov.", scheduled.Message);
    }

    [Fact]
    public void U_A5_TheEstimate_IsComputedInMinorUnits_AndRoundsTheDiscountHalfUp()
    {
        var estimate = SubscriptionEstimate.Compute(1450.00m, 3, 7.5m);
        Assert.Equal(4350.00m, estimate.Subtotal);
        Assert.Equal(326.25m, estimate.DiscountAmount);
        Assert.Equal(4023.75m, estimate.EstimatedTotal);

        // 10.10 x 5 % = 0.505 -> 0.51 (half away from zero; banker's rounding would give 0.50)
        Assert.Equal(0.51m, SubscriptionEstimate.Compute(10.10m, 1, 5m).DiscountAmount);
        Assert.Equal(1450.00m, SubscriptionEstimate.Compute(1450.00m, 1, 0m).EstimatedTotal);
    }

    // ── C: before the cut-off (AC1) ──────────────────────────────────────────────────────────────

    [Fact]
    public void U_C1_Unlocked_ChangingTheQuantity_AppliesToTheNextDelivery()
    {
        var subscription = Active();
        var outcome = subscription.ChangeTerms(Terms(quantity: 5), Clock(Oct1), User, Guid.NewGuid());

        Assert.Equal(5, subscription.Terms.Quantity);
        Assert.Null(subscription.PendingTerms);
        Assert.True(outcome.AppliedImmediately);
        Assert.Equal(D(10, 4), outcome.AppliesFromCycleOn);
    }

    [Fact]
    public void U_C2_Unlocked_ChangingTheInterval_RecomputesTheNextDateFromTheLastCycle()
    {
        var subscription = WithLastCycleOn22Sep(interval: 4);
        Assert.Equal(D(10, 20), subscription.NextDeliveryOn);

        subscription.ChangeTerms(Terms(interval: 8), Clock(Oct1), User, Guid.NewGuid());

        Assert.Equal(D(11, 17), subscription.NextDeliveryOn);   // 22 Sep + 56 days
        Assert.Equal(D(10, 1), subscription.NextDeliverySetOn);
    }

    [Fact]
    public void U_C3_Unlocked_ChangingTheIntervalBeforeAnyCycle_LeavesTheNextDateAlone()
    {
        var subscription = Active();
        subscription.ChangeTerms(Terms(interval: 8), Clock(Oct1), User, Guid.NewGuid());

        Assert.Equal(D(10, 4), subscription.NextDeliveryOn);
        Assert.Equal(8, subscription.Terms.IntervalWeeks);
    }

    [Fact]
    public void U_C4_Unlocked_ARecomputedDateInsideTheCutoff_IsFlooredAtTheEarliestDelivery()
    {
        var subscription = WithLastCycleOn22Sep(interval: 4);
        var oct10 = Clock(new DateTimeOffset(2026, 10, 10, 6, 0, 0, TimeSpan.Zero));   // earliest = 13 Oct; 20 Oct is still unlocked

        subscription.ChangeTerms(Terms(interval: 2), oct10, User, Guid.NewGuid());      // 22 Sep + 14 days = 6 Oct, in the past

        Assert.Equal(D(10, 13), subscription.NextDeliveryOn);
    }

    [Fact]
    public void U_C5_Unlocked_Skipping_MovesTheNextDeliveryOneInterval()
    {
        var subscription = Active();
        var outcome = subscription.SkipDelivery(D(10, 4), Clock(Oct1), User, Guid.NewGuid());

        Assert.Equal(D(11, 1), subscription.NextDeliveryOn);   // + 4 weeks
        Assert.Equal(D(10, 4), subscription.LastSkippedOn);
        Assert.True(outcome.AppliedImmediately);
        Assert.Contains(subscription.Events, e => e is SubscriptionDeliverySkippedEvent);
    }

    [Fact]
    public void U_C5b_Unlocked_SkippingAnyOtherDate_IsRefusedNamingTheNextOne()
    {
        var subscription = Active();
        var ex = Assert.Throws<DomainRuleViolationException>(() => subscription.SkipDelivery(D(10, 18), Clock(Oct1), User, Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.CycleNoLongerSkippable, ex.ErrorCode);
        Assert.Contains("Sun 4 Oct", ex.Message);
    }

    [Fact]
    public void U_C6_Unlocked_Pausing_StopsTheSchedule_AndCancellingEndsIt()
    {
        var paused = Active();
        var pause = paused.Pause(Clock(Oct1), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Paused, paused.Status);
        Assert.Null(paused.NextDeliveryOn);
        Assert.True(pause.AppliedImmediately);

        var cancelled = Active();
        cancelled.Cancel(Customer, SubscriptionCancellationReason.TooExpensive, "pricey", Clock(Oct1), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Cancelled, cancelled.Status);
        Assert.Null(cancelled.NextDeliveryOn);
        Assert.Equal(SubscriptionCancellationReason.TooExpensive, cancelled.CancellationReason);
        Assert.Equal("pricey", cancelled.CancellationNote);
        Assert.NotNull(cancelled.CancelledOn);
    }

    // ── C: after the cut-off (AC2) ───────────────────────────────────────────────────────────────

    [Fact]
    public void U_C7_Locked_ChangingTheQuantity_IsScheduledForTheFollowingCycle()
    {
        var subscription = Active();
        var outcome = subscription.ChangeTerms(Terms(quantity: 5), Clock(Oct1Locked), User, Guid.NewGuid());

        Assert.Equal(2, subscription.Terms.Quantity);          // unchanged
        Assert.Equal(5, subscription.PendingTerms!.Quantity);
        Assert.False(outcome.AppliedImmediately);
        Assert.Equal(D(11, 1), outcome.AppliesFromCycleOn);    // 4 Oct + 4 weeks
        Assert.Contains(subscription.Events, e => e is SubscriptionTermsChangedEvent { AppliedImmediately: false });
    }

    [Fact]
    public void U_C7b_Locked_ChangingTheInterval_NamesTheDateOnTheNewInterval()
    {
        var subscription = Active();
        var outcome = subscription.ChangeTerms(Terms(interval: 8), Clock(Oct1Locked), User, Guid.NewGuid());

        Assert.Equal(D(11, 29), outcome.AppliesFromCycleOn);   // 4 Oct + 8 weeks
        Assert.Equal(D(10, 4), subscription.NextDeliveryOn);   // the locked order still goes
    }

    [Fact]
    public void U_C8_Locked_Skipping_TheNextDateIsRefused_TheFollowingIsScheduled_AndTwiceIsRefused()
    {
        var subscription = Active();
        var locked = Clock(Oct1Locked);

        var stale = Assert.Throws<DomainRuleViolationException>(() => subscription.SkipDelivery(D(10, 4), locked, User, Guid.NewGuid()));
        Assert.Equal(BusinessViolationCodes.CycleNoLongerSkippable, stale.ErrorCode);
        Assert.Contains("Sun 1 Nov", stale.Message);           // names the date that can still be skipped

        var outcome = subscription.SkipDelivery(D(11, 1), locked, User, Guid.NewGuid());
        Assert.True(subscription.PendingSkip);
        Assert.False(outcome.AppliedImmediately);
        Assert.Equal(D(11, 1), outcome.AppliesFromCycleOn);

        Assert.Equal(BusinessViolationCodes.SkipAlreadyScheduled, Code(() => subscription.SkipDelivery(D(11, 1), locked, User, Guid.NewGuid())));
    }

    [Fact]
    public void U_C9_Locked_PauseAndCancel_AreScheduled_TheStatusStaysActive()
    {
        var pausing = Active();
        var pause = pausing.Pause(Clock(Oct1Locked), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Active, pausing.Status);
        Assert.Equal(SubscriptionPendingStatusChange.Pause, pausing.PendingStatusChange);
        Assert.False(pause.AppliedImmediately);
        Assert.Contains(pausing.Events, e => e is SubscriptionChangeScheduledEvent);

        var cancelling = Active();
        var cancel = cancelling.Cancel(Customer, SubscriptionCancellationReason.NoLongerNeeded, null, Clock(Oct1Locked), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Active, cancelling.Status);
        Assert.Equal(SubscriptionPendingStatusChange.Cancel, cancelling.PendingStatusChange);
        Assert.Equal(D(10, 4), cancelling.NextDeliveryOn);     // the locked order still goes
        Assert.Contains("will still arrive", cancel.Message);
    }

    [Fact]
    public void U_C10_RecordingTheCycle_AppliesPendingTerms_ThenSkip_ThenThePause()
    {
        var subscription = Active();
        var locked = Clock(Oct1Locked);
        subscription.SkipDelivery(D(11, 1), locked, User, Guid.NewGuid());
        subscription.ChangeTerms(Terms(interval: 8), locked, User, Guid.NewGuid());
        subscription.Pause(locked, User, Guid.NewGuid());

        subscription.RecordCycleProcessed(D(10, 4), SubscriptionCycleOutcome.Generated, null, Clock(new DateTimeOffset(2026, 10, 4, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());

        Assert.Equal(8, subscription.Terms.IntervalWeeks);
        Assert.Equal(SubscriptionStatus.Paused, subscription.Status);
        Assert.Null(subscription.NextDeliveryOn);
        Assert.Null(subscription.PendingTerms);
        Assert.False(subscription.PendingSkip);
        Assert.Null(subscription.PendingStatusChange);
        Assert.Equal(D(10, 4), subscription.LastCycleOn);
    }

    [Fact]
    public void U_C11_RecordingTheCycle_WithAPendingSkip_AdvancesTwoIntervals()
    {
        var subscription = Active();
        subscription.SkipDelivery(D(11, 1), Clock(Oct1Locked), User, Guid.NewGuid());

        subscription.RecordCycleProcessed(D(10, 4), SubscriptionCycleOutcome.Generated, null, Clock(new DateTimeOffset(2026, 10, 4, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());

        Assert.Equal(D(11, 29), subscription.NextDeliveryOn);   // 4 Oct + 8 weeks
        Assert.Equal(D(11, 1), subscription.LastSkippedOn);
        Assert.False(subscription.PendingSkip);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
    }

    [Fact]
    public void U_C12_APendingCancellation_WinsOverASuspendingFailure()
    {
        var subscription = Active();
        subscription.Cancel(Customer, SubscriptionCancellationReason.NoLongerNeeded, null, Clock(Oct1Locked), User, Guid.NewGuid());

        subscription.RecordCycleProcessed(
            D(10, 4), SubscriptionCycleOutcome.Failed, SubscriptionCycleFailureReason.ProductUnavailable,
            Clock(new DateTimeOffset(2026, 10, 4, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());

        Assert.Equal(SubscriptionStatus.Cancelled, subscription.Status);
        Assert.Null(subscription.SuspensionReason);
        Assert.DoesNotContain(subscription.Events, e => e is SubscriptionSuspendedEvent);
    }

    [Fact]
    public void U_C12b_AFailureThatNoRetryWouldFix_SuspendsTheSubscription_AnOutOfStockOneDoesNot()
    {
        var unavailable = Active();
        unavailable.RecordCycleProcessed(
            D(10, 4), SubscriptionCycleOutcome.Failed, SubscriptionCycleFailureReason.ProductUnavailable, Clock(new DateTimeOffset(2026, 10, 4, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Suspended, unavailable.Status);
        Assert.Equal(SubscriptionSuspensionReason.ProductUnavailable, unavailable.SuspensionReason);
        Assert.Null(unavailable.NextDeliveryOn);

        var outOfStock = Active();
        outOfStock.RecordCycleProcessed(
            D(10, 4), SubscriptionCycleOutcome.Failed, SubscriptionCycleFailureReason.OutOfStock, Clock(new DateTimeOffset(2026, 10, 4, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Active, outOfStock.Status);
        Assert.Equal(D(11, 1), outOfStock.NextDeliveryOn);     // the cycle is consumed; the next one runs as scheduled
    }

    [Fact]
    public void RecordingACycleThatIsNotDue_IsRefused_CycleNotDue()
    {
        var subscription = Active();
        Assert.Equal(BusinessViolationCodes.CycleNotDue, Code(() => subscription.RecordCycleProcessed(
            D(10, 11), SubscriptionCycleOutcome.Generated, null, Clock(Oct1), User, Guid.NewGuid())));
    }

    [Fact]
    public void U_C13_WithdrawingWhenNothingIsPending_IsRefused()
    {
        Assert.Equal(BusinessViolationCodes.NoPendingChange, Code(() => Active().WithdrawPendingChanges(Clock(Oct1), User, Guid.NewGuid())));
    }

    [Fact]
    public void U_C13b_Withdrawing_ClearsEveryScheduledChange_AndForgetsAScheduledCancellationsReason()
    {
        var subscription = Active();
        var locked = Clock(Oct1Locked);
        subscription.ChangeTerms(Terms(quantity: 9), locked, User, Guid.NewGuid());
        subscription.SkipDelivery(D(11, 1), locked, User, Guid.NewGuid());
        subscription.Cancel(Customer, SubscriptionCancellationReason.TooMuchStock, "note", locked, User, Guid.NewGuid());

        subscription.WithdrawPendingChanges(locked, User, Guid.NewGuid());

        Assert.Null(subscription.PendingTerms);
        Assert.False(subscription.PendingSkip);
        Assert.Null(subscription.PendingStatusChange);
        Assert.Null(subscription.CancellationReason);
        Assert.Null(subscription.CancellationNote);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
    }

    [Fact]
    public void U_C14_ChangingToIdenticalTerms_IsRefused_NoChangeRequested()
    {
        var subscription = Active();
        Assert.Equal(BusinessViolationCodes.NoChangeRequested, Code(() => subscription.ChangeTerms(Terms(), Clock(Oct1), User, Guid.NewGuid())));
    }

    [Fact]
    public void APausedSubscription_AcceptsATermsChange_Immediately_AndResumesOnAChosenDate()
    {
        var subscription = Active();
        subscription.Pause(Clock(Oct1), User, Guid.NewGuid());

        var change = subscription.ChangeTerms(Terms(quantity: 7), Clock(Oct1), User, Guid.NewGuid());
        Assert.True(change.AppliedImmediately);
        Assert.Equal(7, subscription.Terms.Quantity);

        var resume = subscription.Resume(D(10, 20), Clock(Oct1), User, Guid.NewGuid());
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal(D(10, 20), subscription.NextDeliveryOn);
        Assert.Equal(D(10, 20), resume.AppliesFromCycleOn);
        Assert.Null(subscription.PausedOn);
    }

    [Fact]
    public void AllowedActions_FollowTheSameRulesTheAggregateEnforces()
    {
        var unlocked = SubscriptionSchedule.AllowedActions(Active().ToScheduleState(), Clock(Oct1));
        Assert.Equal(["ChangeTerms", "Skip", "Pause", "Cancel"], unlocked);

        var locked = Active();
        Assert.Equal(["ChangeTerms", "Skip", "Pause", "Cancel"], SubscriptionSchedule.AllowedActions(locked.ToScheduleState(), Clock(Oct1Locked)));
        locked.SkipDelivery(D(11, 1), Clock(Oct1Locked), User, Guid.NewGuid());
        Assert.Equal(["ChangeTerms", "Pause", "Cancel", "WithdrawPending"], SubscriptionSchedule.AllowedActions(locked.ToScheduleState(), Clock(Oct1Locked)));

        var paused = Active();
        paused.Pause(Clock(Oct1), User, Guid.NewGuid());
        Assert.Equal(["ChangeTerms", "Resume", "Cancel"], SubscriptionSchedule.AllowedActions(paused.ToScheduleState(), Clock(Oct1)));

        var suspended = Active();
        suspended.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, User, Guid.NewGuid());
        Assert.Equal(["Cancel"], SubscriptionSchedule.AllowedActions(suspended.ToScheduleState(), Clock(Oct1)));

        var cancelled = Active();
        cancelled.Cancel(Customer, SubscriptionCancellationReason.Other, null, Clock(Oct1), User, Guid.NewGuid());
        Assert.Empty(SubscriptionSchedule.AllowedActions(cancelled.ToScheduleState(), Clock(Oct1)));
    }
}
