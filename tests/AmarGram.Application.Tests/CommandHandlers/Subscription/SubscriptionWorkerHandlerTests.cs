using AmarGram.Application.CommandHandlers.Subscription;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using static AmarGram.Application.Tests.TestSupport.SubscriptionWorld;

namespace AmarGram.Application.Tests.CommandHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.4 C8, C9 and C11 -- the handlers the worker (and staff) drive. C8 is <b>idempotent</b> (a retried or crashed cycle is exactly-once in effect, ADR-241); C9 only
/// <i>nominates</i> are re-checked (ADR-243); C11 lifts a suspension without re-creating the subscription.
/// </summary>
public sealed class SubscriptionWorkerHandlerTests
{
    private static readonly DateTimeOffset Oct4 = new(2026, 10, 4, 6, 0, 0, TimeSpan.Zero);   // the day the first cycle is due

    private static RecordSubscriptionCycleCommandHandler Record(SubscriptionWorld w) =>
        new(NullLogger<RecordSubscriptionCycleCommandHandler>.Instance, w.Subscriptions, w.CycleStore, w.Finder, w.Clock, w.Settings, w.Outbox, w.Links);

    private static RecordSubscriptionCycleCommand Generated(
        SubscriptionAggregate s, string status = "Confirmed", DateTimeOffset? expires = null, decimal? total = 1000m, Guid? orderId = null) => new()
    {
        SubscriptionCycleId = Guid.NewGuid(), SubscriptionId = s.Id, CycleOn = D(10, 4), IdempotencyKey = SubscriptionKeys.IdempotencyKey(s.Id, D(10, 4)), DiscountPercent = 10m,
        OrderId = orderId ?? Guid.NewGuid(), OrderNumber = "ORD-100", OrderStatus = status, PaymentExpiresOn = expires, OrderTotal = total, CurrencyCode = "BDT",
        UserContext = new(SystemActors.SubscriptionWorker, Guid.Empty), CorrelationId = Guid.NewGuid(),
    };

    private static RecordSubscriptionCycleCommand Failed(SubscriptionAggregate s, string code) => new()
    {
        SubscriptionCycleId = Guid.NewGuid(), SubscriptionId = s.Id, CycleOn = D(10, 4), IdempotencyKey = SubscriptionKeys.IdempotencyKey(s.Id, D(10, 4)), DiscountPercent = 0m,
        FailureCode = code, UserContext = new(SystemActors.SubscriptionWorker, Guid.Empty), CorrelationId = Guid.NewGuid(),
    };

    // ── C8 ───────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_D1_ACodCycle_IsRecordedAndTheSubscriptionAdvancesInTheSameUnit()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();

        var response = await Record(w).HandleAsync(Generated(subscription));

        Assert.True(response.IsSuccess);
        var cycle = Assert.Single(w.Cycles.Saved);
        Assert.Equal(SubscriptionCycleOutcome.Generated, cycle.Outcome);
        Assert.Equal(SubscriptionCycleOrderState.Confirmed, cycle.OrderState);
        Assert.Equal(10m, cycle.DiscountPercent);                       // the setting at generation, snapshotted (US-SUB-04)
        Assert.Equal(subscription.Id, cycle.SubscriptionId);
        Assert.Same(subscription, Assert.Single(w.Subscriptions.Updated));
        Assert.Equal(D(10, 4), subscription.LastCycleOn);
        Assert.Equal(D(11, 1), subscription.NextDeliveryOn);             // + 4 weeks
        Assert.Empty(w.Outbox.Requests);                                 // a confirmed COD order needs no reminder; Orders sends its own messages
    }

    [Fact]
    public async Task I_D2_ABankTransferCycle_HoldsTheOrder_AndQueuesThePaymentReminderBeforeItsWindowCloses()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive(method: SubscriptionPaymentMethod.BankTransfer);
        var expires = Oct4.AddHours(48);

        await Record(w).HandleAsync(Generated(subscription, "PendingPayment", expires, total: 1450m));

        var cycle = Assert.Single(w.Cycles.Saved);
        Assert.Equal(SubscriptionCycleOrderState.AwaitingPayment, cycle.OrderState);
        Assert.Equal(expires, cycle.PaymentExpiresOn);

        var reminder = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionPaymentReminder, reminder.TemplateKey);
        Assert.Equal(expires.AddHours(-24), reminder.SendAfter);
        Assert.Equal(expires, reminder.NotAfter);
        Assert.Equal(NotificationSubjectKind.SubscriptionOrderAwaitingPayment, reminder.SubjectKind);
        Assert.Equal(cycle.Id, reminder.SubjectId);
        Assert.Contains("1,450.00", reminder.Variables["amountDue"]);
        Assert.Equal("https://t/orders/" + cycle.OrderId, reminder.Variables["orderLink"]);
        Assert.Equal(w.CustomerId, reminder.RecipientId);
    }

    [Fact]
    public async Task U_E5_AReminderWhoseSendTimeIsAlreadyPast_IsNotQueued_AndNeitherIsOneWhenTheSettingIsOff()
    {
        var late = new SubscriptionWorld(Oct4);
        var lateSubscription = late.AddActive(method: SubscriptionPaymentMethod.BankTransfer);
        await Record(late).HandleAsync(Generated(lateSubscription, "PendingPayment", Oct4.AddHours(10)));   // 10 h left, reminder is due 24 h before
        Assert.Empty(late.Outbox.Requests);
        Assert.Single(late.Cycles.Saved);

        var off = new SubscriptionWorld(Oct4, reminderHours: 0);
        var offSubscription = off.AddActive(method: SubscriptionPaymentMethod.BankTransfer);
        await Record(off).HandleAsync(Generated(offSubscription, "PendingPayment", Oct4.AddHours(48)));
        Assert.Empty(off.Outbox.Requests);
    }

    [Fact]
    public async Task I_D3_ARetriedCycle_FindsItsRecord_NothingIsWrittenTwice()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();
        var first = Generated(subscription);

        await Record(w).HandleAsync(first);
        var again = await Record(w).HandleAsync(Generated(subscription));   // the next pass, same (subscription, date)

        Assert.True(again.IsSuccess);
        Assert.Single(w.Cycles.Saved);
        Assert.Single(w.Subscriptions.Updated);
        Assert.Equal(1, w.CycleStore.Attempts);
        Assert.Equal(D(11, 1), subscription.NextDeliveryOn);               // advanced once, not twice
    }

    [Fact]
    public async Task I_D3b_ALostRaceOnTheCycleIndex_IsASuccess_AndTheSubscriptionIsNotSaved()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();
        w.CycleStore.LoseTheRace = true;

        var response = await Record(w).HandleAsync(Generated(subscription));

        Assert.True(response.IsSuccess);
        Assert.Empty(w.Subscriptions.Updated);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task C8_ASubscriptionThatIsNoLongerDueOnThatDate_IsLogged_AndNothingIsRecorded()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();
        subscription.Pause(w.ClockAt(Oct1), w.StaffUser(), Guid.NewGuid());   // paused between the worker's query and the record

        var response = await Record(w).HandleAsync(Generated(subscription));

        Assert.True(response.IsSuccess);
        Assert.Empty(w.Cycles.Saved);
        Assert.Empty(w.Subscriptions.Updated);
    }

    [Fact]
    public async Task C8_AnUnknownSubscription_IsASuccessWithNoWrite()
    {
        var w = new SubscriptionWorld(Oct4);
        var ghost = w.AddActive();
        var command = Generated(ghost);
        var other = new SubscriptionWorld(Oct4);

        var response = await Record(other).HandleAsync(command);

        Assert.True(response.IsSuccess);
        Assert.Empty(other.Cycles.Saved);
    }

    [Fact]
    public async Task I_D4_AnOutOfStockCycle_IsFailed_TheCustomerIsTold_AndTheSubscriptionMovesOn()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();

        await Record(w).HandleAsync(Failed(subscription, BusinessViolationCodes.StockNoLongerAvailable));

        var cycle = Assert.Single(w.Cycles.Saved);
        Assert.Equal(SubscriptionCycleOutcome.Failed, cycle.Outcome);
        Assert.Equal(SubscriptionCycleFailureReason.OutOfStock, cycle.FailureReason);
        Assert.Equal(BusinessViolationCodes.StockNoLongerAvailable, cycle.FailureCode);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal(D(11, 1), subscription.NextDeliveryOn);              // consumed, not retried (OQ-4)

        var message = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionCycleFailed, message.TemplateKey);
        Assert.Equal($"subscription.cycle-failed:{subscription.Id:N}:20261004", message.DeduplicationKey);
    }

    [Fact]
    public async Task I_D7_AnUnavailableProduct_FailsTheCycle_AndSuspendsTheSubscription_WithBothMessages()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();

        await Record(w).HandleAsync(Failed(subscription, BusinessViolationCodes.SkuNotPurchasable));

        Assert.Equal(SubscriptionStatus.Suspended, subscription.Status);
        Assert.Equal(SubscriptionSuspensionReason.ProductUnavailable, subscription.SuspensionReason);
        Assert.Equal(
            [NotificationTemplateCatalogue.SubscriptionCycleFailed, NotificationTemplateCatalogue.SubscriptionSuspended],
            w.Outbox.Requests.Select(r => r.TemplateKey));
        Assert.Contains(subscription.Events, e => e is SubscriptionSuspendedEvent);
    }

    [Fact]
    public async Task I_D8_AnUnknownOrdersRefusal_IsOrderRefused_TheRawCodeIsKept_TheSubscriptionStaysActive()
    {
        var w = new SubscriptionWorld(Oct4);
        var subscription = w.AddActive();

        await Record(w).HandleAsync(Failed(subscription, "SomeNewOrdersCode"));

        var cycle = Assert.Single(w.Cycles.Saved);
        Assert.Equal(SubscriptionCycleFailureReason.OrderRefused, cycle.FailureReason);
        Assert.Equal("SomeNewOrdersCode", cycle.FailureCode);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
    }

    // ── C9 ───────────────────────────────────────────────────────────────────────────────────────

    private static SuspendSubscriptionCommandHandler Suspend(SubscriptionWorld w) =>
        new(w.Subscriptions, w.Finder, w.Settings, new FakeTimeProvider(w.Now), w.Outbox, w.Links);

    private static SuspendSubscriptionCommand SuspendCommand(SubscriptionAggregate s, SubscriptionSuspensionReason? reason = null) => new()
    {
        SubscriptionId = s.Id, Reason = reason ?? SubscriptionSuspensionReason.UnpaidCycles,
        UserContext = new(SystemActors.SubscriptionWorker, Guid.Empty), CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public async Task I_F4_TwoConsecutiveExpiredCycles_SuspendTheSubscription_AndTheCustomerIsTold()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();
        w.AddCycle(subscription, D(8, 4), SubscriptionCycleOrderState.Expired);
        w.AddCycle(subscription, D(9, 1), SubscriptionCycleOrderState.Expired);

        var response = await Suspend(w).HandleAsync(SuspendCommand(subscription));

        Assert.True(response.IsSuccess);
        Assert.Equal(SubscriptionStatus.Suspended, subscription.Status);
        Assert.Equal(SubscriptionSuspensionReason.UnpaidCycles, subscription.SuspensionReason);
        Assert.Same(subscription, Assert.Single(w.Subscriptions.Updated));
        var message = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionSuspended, message.TemplateKey);
        Assert.Contains("2 unpaid orders", message.Variables["reasonText"]);
    }

    [Fact]
    public async Task C9_TheRuleIsReEvaluated_OneUnpaidCycleOrAPaidOneInBetween_WritesNothing()
    {
        var one = new SubscriptionWorld();
        var oneSubscription = one.AddActive();
        one.AddCycle(oneSubscription, D(9, 1), SubscriptionCycleOrderState.Expired);
        await Suspend(one).HandleAsync(SuspendCommand(oneSubscription));
        Assert.Equal(SubscriptionStatus.Active, oneSubscription.Status);
        Assert.Empty(one.Subscriptions.Updated);
        Assert.Empty(one.Outbox.Requests);

        var paid = new SubscriptionWorld();
        var paidSubscription = paid.AddActive();
        paid.AddCycle(paidSubscription, D(8, 4), SubscriptionCycleOrderState.Expired);
        paid.AddCycle(paidSubscription, D(9, 1), SubscriptionCycleOrderState.Confirmed);   // the latest was paid: the streak is 0
        await Suspend(paid).HandleAsync(SuspendCommand(paidSubscription));
        Assert.Equal(SubscriptionStatus.Active, paidSubscription.Status);
    }

    [Fact]
    public async Task C9_AnAlreadySuspendedOrPausedSubscription_IsLeftAlone()
    {
        var w = new SubscriptionWorld();
        var suspended = w.AddActive(skuId: Guid.NewGuid());
        suspended.Suspend(SubscriptionSuspensionReason.ProductUnavailable, Oct1, w.StaffUser(), Guid.NewGuid());
        var paused = w.AddActive(skuId: Guid.NewGuid());
        paused.Pause(w.ClockAt(Oct1), w.StaffUser(), Guid.NewGuid());
        foreach (var s in new[] { suspended, paused })
        {
            w.AddCycle(s, D(8, 4), SubscriptionCycleOrderState.Expired);
            w.AddCycle(s, D(9, 1), SubscriptionCycleOrderState.Expired);
        }

        await Suspend(w).HandleAsync(SuspendCommand(suspended));
        await Suspend(w).HandleAsync(SuspendCommand(paused));

        Assert.Equal(SubscriptionSuspensionReason.ProductUnavailable, suspended.SuspensionReason);
        Assert.Equal(SubscriptionStatus.Paused, paused.Status);
        Assert.Empty(w.Subscriptions.Updated);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task C9_AfterAReinstatement_OnlyCyclesProcessedSinceCountTowardsTheStreak()
    {
        var w = new SubscriptionWorld(Oct1);
        var subscription = w.AddActive();
        w.AddCycle(subscription, D(8, 4), SubscriptionCycleOrderState.Expired, processedOn: Oct1.AddDays(-50));
        w.AddCycle(subscription, D(9, 1), SubscriptionCycleOrderState.Expired, processedOn: Oct1.AddDays(-20));
        var clock = w.ClockAt(Oct1);
        subscription.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1.AddDays(-10), w.StaffUser(), Guid.NewGuid());
        subscription.Reinstate(Guid.NewGuid(), "Customer paid", null, clock, w.StaffUser(), Guid.NewGuid());

        await Suspend(w).HandleAsync(SuspendCommand(subscription));
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);   // the old defaults were forgiven

        w.AddCycle(subscription, D(10, 4), SubscriptionCycleOrderState.Expired, processedOn: Oct1.AddHours(1));
        w.AddCycle(subscription, D(11, 1), SubscriptionCycleOrderState.Expired, processedOn: Oct1.AddHours(2));
        await Suspend(w).HandleAsync(SuspendCommand(subscription));
        Assert.Equal(SubscriptionStatus.Suspended, subscription.Status);
    }

    // ── C11 ──────────────────────────────────────────────────────────────────────────────────────

    private static ReinstateSubscriptionCommandHandler Reinstate(SubscriptionWorld w) => new(w.Subscriptions, w.Catalogue, w.Clock, w.Outbox, w.Links);

    private static ReinstateSubscriptionCommand ReinstateCommand(SubscriptionAggregate s, SubscriptionWorld w, string reason = "Paid by transfer") => new()
    {
        SubscriptionId = s.Id, Reason = reason, UserContext = w.StaffUser(), CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public async Task I_F7_StaffReinstate_ASuspendedSubscription_WithoutRecreatingIt_AndTheCustomerIsTold()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();
        var id = subscription.Id;
        subscription.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, w.StaffUser(), Guid.NewGuid());

        var response = await Reinstate(w).HandleAsync(ReinstateCommand(subscription, w));

        Assert.True(response.IsSuccess);
        Assert.Equal(id, subscription.Id);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal(D(10, 4), subscription.NextDeliveryOn);
        var message = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionResumed, message.TemplateKey);
        Assert.Equal("Sun 4 Oct", message.Variables["nextDeliveryOn"]);
    }

    [Fact]
    public async Task C11_ReinstatingWhatIsNotSuspended_OrWithoutAReason_IsRefused()
    {
        var w = new SubscriptionWorld();
        var active = w.AddActive();
        var suspended = w.AddActive(skuId: Guid.NewGuid());
        w.Catalogue.Add(suspended.SkuId);
        suspended.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, w.StaffUser(), Guid.NewGuid());

        Assert.Equal(BusinessViolationCodes.SubscriptionCannotBeReinstated, Codes(await Reinstate(w).HandleAsync(ReinstateCommand(active, w))));
        Assert.Equal(BusinessViolationCodes.ReinstatementReasonRequired, Codes(await Reinstate(w).HandleAsync(ReinstateCommand(suspended, w, reason: "  "))));
        Assert.Equal(SubscriptionStatus.Suspended, suspended.Status);
        Assert.Empty(w.Outbox.Requests);
        Assert.Empty(w.Subscriptions.Updated);
    }

    [Fact]
    public async Task C11_AProductThatCannotBeBoughtAgain_BlocksTheReinstatement()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();
        subscription.Suspend(SubscriptionSuspensionReason.ProductUnavailable, Oct1, w.StaffUser(), Guid.NewGuid());
        w.Catalogue.Add(w.SkuId, purchasable: false);

        var response = await Reinstate(w).HandleAsync(ReinstateCommand(subscription, w));

        Assert.Equal(BusinessViolationCodes.SkuNotSubscribable, Codes(response));
        Assert.Equal(SubscriptionStatus.Suspended, subscription.Status);
    }

    [Fact]
    public async Task C11_AnUnknownSubscription_IsNotFound()
    {
        var w = new SubscriptionWorld();
        var ghost = w.AddActive();
        var other = new SubscriptionWorld();

        Assert.Equal(BusinessViolationCodes.SubscriptionNotFound, Codes(await Reinstate(other).HandleAsync(ReinstateCommand(ghost, w))));
    }
}
