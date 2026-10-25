using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using static AmarGram.Application.CommandHandlers.Subscription.SubscriptionResults;

namespace AmarGram.Application.CommandHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.4 C8 (US-SUB-01 AC2, ADR-240, ADR-241) -- record one processed cycle. <b>Idempotent</b>: a cycle row for <c>(subscription, date)</c> already
/// there is a success and nothing is written (a retried pass); a subscription that changed between the worker's query and this record (no longer <c>Active</c>, or
/// no longer due on that date) is logged with ids and succeeds without writing -- the order, if any, stands as an ordinary order. Otherwise the cycle is
/// built (<c>RecordGenerated</c> / <c>RecordFailed</c> with the classifier's reason), the subscription advances (<c>RecordCycleProcessed</c>), the messages are
/// enqueued, and <b>one save commits the cycle and the subscription together</b> -- both are tracked before the first save (F23). A lost race on
/// <c>ix_subscription_cycle_per_date</c> is a success; a <c>409</c> on the subscription rolls the whole save back and the next pass retries.
/// </summary>
public sealed class RecordSubscriptionCycleCommandHandler(
    ILogger<RecordSubscriptionCycleCommandHandler> logger,
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    ISubscriptionCycleStore cycleStore,
    ISubscriptionFinder finder,
    ICommerceClock commerceClock,
    IBusinessSettings settings,
    INotificationOutbox outbox,
    INotificationLinkBuilder links)
    : ICommandHandlerAsync<RecordSubscriptionCycleCommand>
{
    public async Task<CommandResponse> HandleAsync(RecordSubscriptionCycleCommand command)
    {
        if (await finder.FindCycleIdAsync(command.SubscriptionId, command.CycleOn, default) is not null) return Success();

        var subscription = await subscriptions.GetByIdAsync(command.SubscriptionId);
        if (subscription is null) return Success();

        if (subscription.Status != SubscriptionStatus.Active || subscription.NextDeliveryOn != command.CycleOn)
        {
            logger.LogWarning(
                "Subscription {SubscriptionId} is no longer due on {CycleOn}; the cycle was not recorded. CorrelationId: {CorrelationId}",
                command.SubscriptionId, command.CycleOn, command.CorrelationId);
            return Success();
        }

        var clock = await commerceClock.GetAsync();
        var user = command.UserContext!;
        var cycle = new SubscriptionCycleAggregate(command.SubscriptionCycleId);

        SubscriptionCycleFailureReason? failure = null;
        if (command.OrderId is { } orderId)
        {
            // The placed order's status as the mirror's first state (an already-placed order returned by a retried pass may be further along).
            var state = command.OrderStatus == OrderStatus.PendingPayment.DisplayName ? SubscriptionCycleOrderState.AwaitingPayment
                : command.OrderStatus == OrderStatus.Cancelled.DisplayName ? SubscriptionCycleOrderState.Cancelled
                : command.OrderStatus == OrderStatus.Delivered.DisplayName ? SubscriptionCycleOrderState.Delivered
                : SubscriptionCycleOrderState.Confirmed;

            cycle.RecordGenerated(new CycleGeneratedDto(
                command.SubscriptionCycleId, subscription.Id, subscription.CustomerId, command.CycleOn, subscription.SkuId, subscription.Terms.Quantity,
                subscription.Terms.Fulfilment, subscription.Terms.PaymentMethod, command.DiscountPercent, command.IdempotencyKey, orderId, command.OrderNumber!, state,
                command.PaymentExpiresOn, clock.Now, user, command.CorrelationId));
        }
        else
        {
            failure = SubscriptionFailureClassifier.Classify(command.FailureCode);
            cycle.RecordFailed(new CycleFailedDto(
                command.SubscriptionCycleId, subscription.Id, subscription.CustomerId, command.CycleOn, subscription.SkuId, subscription.Terms.Quantity,
                subscription.Terms.Fulfilment, subscription.Terms.PaymentMethod, command.DiscountPercent, command.IdempotencyKey, failure, command.FailureCode, clock.Now,
                user, command.CorrelationId));
        }

        try
        {
            subscription.RecordCycleProcessed(
                command.CycleOn, failure is null ? SubscriptionCycleOutcome.Generated : SubscriptionCycleOutcome.Failed, failure, clock, user, command.CorrelationId);
        }
        catch (DomainRuleViolationException)
        {
            return Success(); // not due after all (a race with a customer change): nothing recorded
        }

        if (failure is not null)
        {
            SubscriptionNotifications.EnqueueCycleFailed(outbox, links, subscription, command.CycleOn, failure, command.CorrelationId, user);
            if (subscription.Status == SubscriptionStatus.Suspended)
                SubscriptionNotifications.EnqueueSuspended(outbox, links, subscription, settings.GetInt(SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles), command.CorrelationId, user);
        }
        else if (cycle.OrderState == SubscriptionCycleOrderState.AwaitingPayment && command.OrderTotal is { } total)
        {
            SubscriptionNotifications.EnqueuePaymentReminder(
                outbox, links, subscription, cycle, total, command.CurrencyCode ?? settings.GetString(SettingKeys.CommerceCurrencyCode),
                settings.GetInt(SettingKeys.SubscriptionPaymentReminderHours), clock, command.CorrelationId, user);
        }

        // The subscription is tracked and already mutated: saving the cycle commits both together (ADR-240, F23).
        if (!await cycleStore.TrySaveAsync(cycle)) return Success();

        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success();
    }
}

/// <summary>
/// HO-SUB-001 §11.4 C9 (US-SUB-06, ADR-243) -- suspend for unpaid cycles. The worker's pass only <i>nominates</i>: this handler <b>re-evaluates the rule</b>
/// (<c>UnpaidCycleRule.Streak</c> over the latest cycles since any reinstatement, against <c>subscription.maxConsecutiveUnpaidCycles</c>) and writes nothing when
/// it no longer holds. Then <c>Suspend</c> and the <c>subscription.suspended</c> message. Only staff can reinstate (OQ-6).
/// </summary>
public sealed class SuspendSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    ISubscriptionFinder finder,
    IBusinessSettings settings,
    TimeProvider timeProvider,
    INotificationOutbox outbox,
    INotificationLinkBuilder links)
    : ICommandHandlerAsync<SuspendSubscriptionCommand>
{
    public async Task<CommandResponse> HandleAsync(SuspendSubscriptionCommand command)
    {
        var subscription = await subscriptions.GetByIdAsync(command.SubscriptionId);
        if (subscription is null || subscription.Status != SubscriptionStatus.Active) return Success();

        var threshold = settings.GetInt(SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles);
        if (command.Reason == SubscriptionSuspensionReason.UnpaidCycles)
        {
            var cycles = await finder.LatestCyclesAsync(subscription.Id, SubscriptionRules.StreakWindow, subscription.ReinstatedOn, default);
            if (UnpaidCycleRule.Streak(cycles) < threshold) return Success();
        }

        if (!subscription.Suspend(command.Reason, timeProvider.GetUtcNow(), command.UserContext!, command.CorrelationId)) return Success();

        SubscriptionNotifications.EnqueueSuspended(outbox, links, subscription, threshold, command.CorrelationId, command.UserContext!);
        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success();
    }
}

/// <summary>
/// HO-SUB-001 §11.4 C11 (US-SUB-06) -- staff (<c>Subscriptions.Manage</c>, checked at the edge) restart a suspended subscription, with a reason, without
/// re-creating it. A <c>ProductUnavailable</c> suspension is only lifted while the product can be bought again. The customer is told.
/// </summary>
public sealed class ReinstateSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    ISubscribableCatalogue catalogue,
    ICommerceClock commerceClock,
    INotificationOutbox outbox,
    INotificationLinkBuilder links)
    : ICommandHandlerAsync<ReinstateSubscriptionCommand>
{
    public async Task<CommandResponse> HandleAsync(ReinstateSubscriptionCommand command)
    {
        var subscription = await subscriptions.GetByIdAsync(command.SubscriptionId);
        if (subscription is null) return NotFound();

        var clock = await commerceClock.GetAsync();
        if (subscription.Status == SubscriptionStatus.Suspended)
        {
            var skus = await catalogue.GetAsync([subscription.SkuId], clock.Now, default);
            if (!skus.TryGetValue(subscription.SkuId, out var sku) || !sku.IsPurchasable)
                return Violation(BusinessViolationCodes.SkuNotSubscribable, nameof(command.SubscriptionId), SubscriptionMessages.SkuNotSubscribableInactive);
        }

        try
        {
            subscription.Reinstate(command.UserContext!.UserId, command.Reason, command.FirstDeliveryOn, clock, command.UserContext!, command.CorrelationId);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        SubscriptionNotifications.EnqueueResumed(outbox, links, subscription, command.CorrelationId, command.UserContext!);
        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success();
    }
}
