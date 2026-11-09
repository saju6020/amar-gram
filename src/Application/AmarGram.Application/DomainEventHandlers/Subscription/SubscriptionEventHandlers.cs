using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Events.Order;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Application.DomainEventHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.6, ADR-243 (C-ORD-3, adapted to this codebase's events) -- mirrors the outcome of a cycle's order onto the cycle. Orders is the authority; the
/// mirror never refuses a fact. For every order event the cycle holding that <c>OrderId</c> is loaded (none -> not a subscription order, or not recorded yet --
/// <c>RecordSubscriptionCycleCommand</c> records the placed order's state itself -> return) and <c>RecordOrderState</c> applied. <b>Idempotent</b>: a redelivery is
/// a no-op (no event, no version bump) and a transition outside the table is ignored and logged at <c>Warning</c> with ids only. <b>Never enqueues</b> and never
/// touches the subscription (HO-NTF-001 ADR-057); the unpaid streak is derived from the cycles, and suspension is a worker-nominated command.
/// Mapping: <c>OrderConfirmedEvent</c> -> Confirmed; <c>OrderCancelledEvent</c> -> Expired when the reason is the payment window (FR-ORD-22), else Cancelled;
/// <c>OrderDeliveredEvent</c> -> Delivered; <c>OrderDeliveryFailedEvent</c> with the Refused reason (a COD parcel refused, OQ-5) -> Refused.
/// </summary>
public sealed class MirrorOrderOutcomeToSubscriptionCycleHandler(
    ILogger<MirrorOrderOutcomeToSubscriptionCycleHandler> logger,
    IAggregateRootRepository<SubscriptionCycleAggregate> cycles,
    TimeProvider timeProvider)
    : IEventHandlerAsync<OrderConfirmedEvent>,
      IEventHandlerAsync<OrderCancelledEvent>,
      IEventHandlerAsync<OrderDeliveredEvent>,
      IEventHandlerAsync<OrderDeliveryFailedEvent>
{
    public Task HandleAsync(OrderConfirmedEvent @event) => MirrorAsync(@event, @event.OrderId, SubscriptionCycleOrderState.Confirmed);

    public Task HandleAsync(OrderCancelledEvent @event) =>
        MirrorAsync(@event, @event.OrderId, @event.Reason == OrderCancellationReason.PaymentWindowExpired.Value ? SubscriptionCycleOrderState.Expired : SubscriptionCycleOrderState.Cancelled);

    public Task HandleAsync(OrderDeliveredEvent @event) => MirrorAsync(@event, @event.OrderId, SubscriptionCycleOrderState.Delivered);

    public Task HandleAsync(OrderDeliveryFailedEvent @event) =>
        @event.Reason == DeliveryFailureReason.Refused.Value ? MirrorAsync(@event, @event.OrderId, SubscriptionCycleOrderState.Refused) : Task.CompletedTask;

    private async Task MirrorAsync(Event @event, Guid orderId, SubscriptionCycleOrderState state)
    {
        var cycle = await cycles.GetByFilterAsync(c => c.OrderId == orderId);
        if (cycle is null || cycle.OrderState == state) return;

        var user = @event.UserContext ?? new UserContext(SystemActors.SubscriptionWorker, Guid.Empty) { UserName = "subscription-worker" };
        if (!cycle.RecordOrderState(state, timeProvider.GetUtcNow(), user, @event.CorrelationId))
        {
            logger.LogWarning("Subscription cycle {CycleId} ignored order state {State} for order {OrderId}.", cycle.Id, state.DisplayName, orderId);
            return;
        }

        await cycles.UpdateAsync(cycle, EventPublishOption.InMemoryPublishOnly);
    }
}

/// <summary>
/// HO-SUB-001 §11.6, ADR-247 (HO-ACC-001 ADR-039) -- <c>CustomerMergedEvent</c> is binding on every context holding a customer id. Each subscription still on the
/// duplicate follows the survivor -- unless the survivor already has a live one for the same SKU, in which case the duplicate's is cancelled (<c>CustomerMerged</c>)
/// and then follows the survivor as history -- and then every cycle of the duplicate moves too. One <c>UpdateAsync</c> per row. Queries for rows <b>still</b> on the duplicate, so a re-send finishes a
/// partial run; idempotent; never enqueues a message.
/// </summary>
public sealed class ReassignSubscriptionsOnCustomerMergedHandler(
    ISubscriptionFinder finder,
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    IAggregateRootRepository<SubscriptionCycleAggregate> cycles,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerMergedEvent>
{
    public async Task HandleAsync(CustomerMergedEvent @event)
    {
        var now = timeProvider.GetUtcNow();
        var user = @event.UserContext ?? new UserContext(SystemActors.SubscriptionWorker, Guid.Empty) { UserName = "subscription-worker" };

        foreach (var id in await finder.FindIdsByCustomerAsync(@event.DuplicateCustomerId, default))
        {
            var subscription = await subscriptions.GetByIdAsync(id);
            if (subscription is null || subscription.CustomerId != @event.DuplicateCustomerId) continue;

            var survivorHasLive = subscription.IsLive && await finder.FindLiveIdAsync(@event.SurvivingCustomerId, subscription.SkuId, default) is not null;

            // The survivor already has a live one for this SKU: the duplicate's is cancelled (CustomerMerged). Either way it then follows the survivor, so the
            // cancelled one is history of the survivor too and a re-send finds nothing still on the duplicate (idempotent, I-H3).
            var changed = survivorHasLive && subscription.CancelAsMergeDuplicate(now, user, @event.CorrelationId);
            changed |= subscription.ReassignCustomerOnMerge(@event.SurvivingCustomerId, user, @event.CorrelationId);
            if (changed) await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        }

        foreach (var id in await finder.FindCycleIdsByCustomerAsync(@event.DuplicateCustomerId, default))
        {
            var cycle = await cycles.GetByIdAsync(id);
            if (cycle is null || !cycle.ReassignCustomer(@event.SurvivingCustomerId)) continue;

            await cycles.UpdateAsync(cycle, EventPublishOption.InMemoryPublishOnly);
        }
    }
}

/// <summary>
/// HO-SUB-001 §11.6, ADR-247 -- <c>CustomerAccountAnonymisedEvent</c>: every non-cancelled subscription of the customer is cancelled (<c>AccountDeleted</c>) and its
/// free-text note cleared, so nothing is ordered later on an account that no longer exists. The one cancellation an event may cause. Idempotent; never enqueues.
/// </summary>
public sealed class CancelSubscriptionsOnAccountDeletedHandler(
    ISubscriptionFinder finder,
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerAccountAnonymisedEvent>
{
    public async Task HandleAsync(CustomerAccountAnonymisedEvent @event)
    {
        var now = timeProvider.GetUtcNow();
        var user = @event.UserContext ?? new UserContext(SystemActors.SubscriptionWorker, Guid.Empty) { UserName = "subscription-worker" };

        foreach (var id in await finder.FindIdsByCustomerAsync(@event.CustomerId, default))
        {
            var subscription = await subscriptions.GetByIdAsync(id);
            if (subscription is null) continue;

            var hadNote = subscription.CancellationNote is not null || subscription.ReinstatementReason is not null;
            if (!subscription.CancelOnAccountDeletion(now, user, @event.CorrelationId) && !hadNote) continue;

            await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        }
    }
}
