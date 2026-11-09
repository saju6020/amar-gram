using AmarGram.Application.DomainEventHandlers.Subscription;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Events.Order;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using static AmarGram.Application.Tests.TestSupport.SubscriptionWorld;

namespace AmarGram.Application.Tests.DomainEventHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.6 -- Orders' outcome mirrored onto the cycle (ADR-243) and the lifecycle reactions to a customer merge and an account deletion (ADR-247). Every handler is
/// <b>idempotent</b> (a redelivered event changes nothing), loops with one update per row, and <b>never enqueues</b> a message (HO-NTF-001 ADR-057).
/// </summary>
public sealed class SubscriptionEventHandlerTests
{
    private static MirrorOrderOutcomeToSubscriptionCycleHandler Mirror(SubscriptionWorld w) =>
        new(NullLogger<MirrorOrderOutcomeToSubscriptionCycleHandler>.Instance, w.Cycles, new FakeTimeProvider(w.Now));

    private static SubscriptionCycleAggregate Cycle(SubscriptionWorld w, SubscriptionCycleOrderState state, Guid orderId) =>
        w.AddCycle(w.AddActive(skuId: Guid.NewGuid()), D(10, 4), state, orderId: orderId);

    // ── the mirror ───────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_F2_ATransferConfirmed_IsMirroredAsConfirmed_AndOnlyOnce()
    {
        var w = new SubscriptionWorld();
        var orderId = Guid.NewGuid();
        var cycle = Cycle(w, SubscriptionCycleOrderState.AwaitingPayment, orderId);

        await Mirror(w).HandleAsync(new OrderConfirmedEvent { OrderId = orderId });
        await Mirror(w).HandleAsync(new OrderConfirmedEvent { OrderId = orderId });   // redelivered

        Assert.Equal(SubscriptionCycleOrderState.Confirmed, cycle.OrderState);
        Assert.Single(w.Cycles.Updated);                                               // I-F8: one state change
        Assert.Single(cycle.Events.OfType<AmarGram.Domain.Events.Subscription.SubscriptionCycleOrderStateChangedEvent>());
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task I_F3_AnOrderCancelledBecauseItsPaymentWindowPassed_IsMirroredAsExpired_AnyOtherCancellationAsCancelled()
    {
        var w = new SubscriptionWorld();
        var expiredOrder = Guid.NewGuid();
        var customerOrder = Guid.NewGuid();
        var expired = Cycle(w, SubscriptionCycleOrderState.AwaitingPayment, expiredOrder);
        var cancelled = Cycle(w, SubscriptionCycleOrderState.AwaitingPayment, customerOrder);

        await Mirror(w).HandleAsync(new OrderCancelledEvent { OrderId = expiredOrder, Reason = OrderCancellationReason.PaymentWindowExpired.Value, WasPaid = false, ByCustomer = false });
        await Mirror(w).HandleAsync(new OrderCancelledEvent { OrderId = customerOrder, Reason = OrderCancellationReason.CustomerRequest.Value, WasPaid = false, ByCustomer = true });

        Assert.Equal(SubscriptionCycleOrderState.Expired, expired.OrderState);
        Assert.True(expired.IsUnpaid);
        Assert.Equal(SubscriptionCycleOrderState.Cancelled, cancelled.OrderState);
        Assert.False(cancelled.IsUnpaid);                                              // cancelling before paying is not a default
    }

    [Fact]
    public async Task TheMirror_FollowsAConfirmedOrderToDeliveredOrRefused()
    {
        var w = new SubscriptionWorld();
        var deliveredOrder = Guid.NewGuid();
        var refusedOrder = Guid.NewGuid();
        var otherFailureOrder = Guid.NewGuid();
        var delivered = Cycle(w, SubscriptionCycleOrderState.Confirmed, deliveredOrder);
        var refused = Cycle(w, SubscriptionCycleOrderState.Confirmed, refusedOrder);
        var undeliverable = Cycle(w, SubscriptionCycleOrderState.Confirmed, otherFailureOrder);

        await Mirror(w).HandleAsync(new OrderDeliveredEvent { OrderId = deliveredOrder, HadCodCollection = true });
        await Mirror(w).HandleAsync(new OrderDeliveryFailedEvent { OrderId = refusedOrder, Reason = DeliveryFailureReason.Refused.Value });
        await Mirror(w).HandleAsync(new OrderDeliveryFailedEvent { OrderId = otherFailureOrder, Reason = DeliveryFailureReason.Undeliverable.Value });

        Assert.Equal(SubscriptionCycleOrderState.Delivered, delivered.OrderState);
        Assert.Equal(SubscriptionCycleOrderState.Refused, refused.OrderState);
        Assert.True(refused.IsUnpaid);                                                 // a refused COD parcel is unpaid (OQ-5)
        Assert.Equal(SubscriptionCycleOrderState.Confirmed, undeliverable.OrderState); // a courier failure is not the customer's default
    }

    [Fact]
    public async Task TheMirror_IgnoresAnOrderThatIsNotASubscriptionOrder_AndATransitionOutsideTheTable()
    {
        var w = new SubscriptionWorld();
        var orderId = Guid.NewGuid();
        var cycle = Cycle(w, SubscriptionCycleOrderState.AwaitingPayment, orderId);

        await Mirror(w).HandleAsync(new OrderConfirmedEvent { OrderId = Guid.NewGuid() });        // an ordinary shop order
        await Mirror(w).HandleAsync(new OrderDeliveredEvent { OrderId = orderId, HadCodCollection = false }); // skips Confirmed: Orders is the authority, the mirror just refuses to guess

        Assert.Equal(SubscriptionCycleOrderState.AwaitingPayment, cycle.OrderState);
        Assert.Empty(w.Cycles.Updated);
    }

    // ── merge (ADR-247, HO-ACC-001 ADR-039) ──────────────────────────────────────────────────────

    private static ReassignSubscriptionsOnCustomerMergedHandler Merge(SubscriptionWorld w) => new(w.Finder, w.Subscriptions, w.Cycles, new FakeTimeProvider(w.Now));

    private static CustomerMergedEvent Merged(Guid duplicate, Guid survivor) =>
        new() { DuplicateCustomerId = duplicate, SurvivingCustomerId = survivor, Reason = "same person", IsReapplication = false };

    [Fact]
    public async Task I_H3_AMergedCustomersSubscriptionsAndCycles_FollowTheSurvivor()
    {
        var w = new SubscriptionWorld();
        var survivor = Guid.NewGuid();
        var duplicate = w.AddActive();
        var cycle = w.AddCycle(duplicate, D(9, 6), SubscriptionCycleOrderState.Confirmed);

        await Merge(w).HandleAsync(Merged(w.CustomerId, survivor));

        Assert.Equal(survivor, duplicate.CustomerId);
        Assert.Equal(SubscriptionStatus.Active, duplicate.Status);
        Assert.Equal(survivor, cycle.CustomerId);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task I_H3_WhenTheSurvivorAlreadyHasALiveOneForTheSameSku_TheDuplicatesIsCancelledAsMerged()
    {
        var w = new SubscriptionWorld();
        var survivor = Guid.NewGuid();
        var theirs = w.AddActive(customerId: survivor);
        var duplicate = w.AddActive();   // same SKU

        await Merge(w).HandleAsync(Merged(w.CustomerId, survivor));

        Assert.Equal(SubscriptionStatus.Active, theirs.Status);
        Assert.Equal(SubscriptionStatus.Cancelled, duplicate.Status);
        Assert.Equal(SubscriptionCancellationReason.CustomerMerged, duplicate.CancellationReason);
        Assert.Equal(survivor, duplicate.CustomerId);                                 // history follows the survivor, so a re-send finds nothing on the duplicate
        Assert.Equal(1, w.Subscriptions.All.Count(s => s.CustomerId == survivor && s.IsLive));   // the one-live-per-SKU rule still holds
    }

    [Fact]
    public async Task I_H3_AReSentMerge_ChangesNothing()
    {
        var w = new SubscriptionWorld();
        var survivor = Guid.NewGuid();
        w.AddActive(customerId: survivor);
        var duplicate = w.AddActive();
        w.AddActive(skuId: Guid.NewGuid());
        w.AddCycle(duplicate, D(9, 6), SubscriptionCycleOrderState.Confirmed);

        await Merge(w).HandleAsync(Merged(w.CustomerId, survivor));
        var subscriptionUpdates = w.Subscriptions.Updated.Count;
        var cycleUpdates = w.Cycles.Updated.Count;
        var versions = w.Subscriptions.All.ToDictionary(s => s.Id, s => s.Version);

        await Merge(w).HandleAsync(Merged(w.CustomerId, survivor));

        Assert.Equal(subscriptionUpdates, w.Subscriptions.Updated.Count);
        Assert.Equal(cycleUpdates, w.Cycles.Updated.Count);
        Assert.All(w.Subscriptions.All, s => Assert.Equal(versions[s.Id], s.Version));
    }

    // ── account deletion ─────────────────────────────────────────────────────────────────────────

    private static CancelSubscriptionsOnAccountDeletedHandler Deleted(SubscriptionWorld w) => new(w.Finder, w.Subscriptions, new FakeTimeProvider(w.Now));

    [Fact]
    public async Task I_H4_DeletingTheAccount_CancelsEveryLiveSubscription_AndForgetsTheNote()
    {
        var w = new SubscriptionWorld();
        var live = w.AddActive();
        var paused = w.AddActive(skuId: Guid.NewGuid());
        paused.Pause(w.ClockAt(Oct1), w.StaffUser(), Guid.NewGuid());
        var alreadyCancelled = w.AddActive(skuId: Guid.NewGuid());
        alreadyCancelled.Cancel(w.CustomerId, SubscriptionCancellationReason.Other, "private words", w.ClockAt(Oct1), w.StaffUser(), Guid.NewGuid());
        var someoneElses = w.AddActive(customerId: Guid.NewGuid());

        await Deleted(w).HandleAsync(new CustomerAccountAnonymisedEvent { CustomerId = w.CustomerId });

        Assert.All(new[] { live, paused, alreadyCancelled }, s => Assert.Equal(SubscriptionStatus.Cancelled, s.Status));
        Assert.Equal(SubscriptionCancellationReason.AccountDeleted, live.CancellationReason);
        Assert.Equal(SubscriptionCancellationReason.Other, alreadyCancelled.CancellationReason);   // not re-labelled...
        Assert.Null(alreadyCancelled.CancellationNote);                                              // ...but its free text is gone
        Assert.Equal(SubscriptionStatus.Active, someoneElses.Status);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task I_H4_AReSentDeletion_ChangesNothing()
    {
        var w = new SubscriptionWorld();
        w.AddActive();
        await Deleted(w).HandleAsync(new CustomerAccountAnonymisedEvent { CustomerId = w.CustomerId });
        var updates = w.Subscriptions.Updated.Count;

        await Deleted(w).HandleAsync(new CustomerAccountAnonymisedEvent { CustomerId = w.CustomerId });

        Assert.Equal(updates, w.Subscriptions.Updated.Count);
    }
}
