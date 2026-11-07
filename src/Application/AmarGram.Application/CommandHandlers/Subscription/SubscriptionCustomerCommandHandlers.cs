using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using static AmarGram.Application.CommandHandlers.Subscription.SubscriptionResults;

namespace AmarGram.Application.CommandHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.4 C1 (US-SUB-01 AC1) -- start a subscription. The handler checks what spans records (the SKU is on offer, the live count, no duplicate, the
/// terms can be served by Orders' own rules) and the aggregate checks what it can see (the terms and the first date). Then <c>Create</c>, the
/// <c>subscription.created</c> message in the same save, and the save. A parallel duplicate loses to <c>ix_subscription_live_per_sku</c> (<c>400
/// SubscriptionAlreadyExists</c>, mapped by the exception filter). A product is subscribable when staff mark it so (BG-15).
/// </summary>
public sealed class CreateSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    ISubscribableCatalogue catalogue,
    ISubscriptionFinder finder,
    ICheckoutInputsLoader inputsLoader,
    ICommerceClock commerceClock,
    IBusinessSettings settings,
    INotificationOutbox outbox,
    INotificationLinkBuilder links)
    : ICommandHandlerAsync<CreateSubscriptionCommand>
{
    public async Task<CommandResponse> HandleAsync(CreateSubscriptionCommand command)
    {
        if (SubscriptionCaller.CustomerId(command) is not { } customerId) return NotFound();

        var clock = await commerceClock.GetAsync();
        var skus = await catalogue.GetAsync([command.SkuId], clock.Now, default);
        if (!skus.TryGetValue(command.SkuId, out var sku))
            return Violation(BusinessViolationCodes.ProductNotFound, nameof(command.SkuId), "That product was not found.");

        if (!sku.IsPurchasable) return Violation(BusinessViolationCodes.SkuNotSubscribable, nameof(command.SkuId), SubscriptionMessages.SkuNotSubscribableInactive);
        if (!sku.IsSubscribable) return Violation(BusinessViolationCodes.SkuNotSubscribable, nameof(command.SkuId), SubscriptionMessages.SkuNotSubscribableNotOffered);

        if (await finder.FindLiveIdAsync(customerId, command.SkuId, default) is not null)
            return Violation(BusinessViolationCodes.SubscriptionAlreadyExists, nameof(command.SkuId), SubscriptionMessages.SubscriptionAlreadyExists);

        if (await finder.CountLiveAsync(customerId, default) >= SubscriptionRules.MaxLiveSubscriptionsPerCustomer)
            return Violation(BusinessViolationCodes.SubscriptionLimitReached, nameof(command.SkuId), SubscriptionMessages.SubscriptionLimitReached);

        SubscriptionTerms terms;
        try
        {
            terms = SubscriptionTerms.Create(command.Quantity, command.IntervalWeeks, command.Fulfilment, command.DeliveryAddressId, command.PickupBranchId, command.PaymentMethod);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        // The terms must be servable by Orders' own rules: the address in the customer's book and inside a zone, the branch open for collection, the payment
        // method available at this value (BR-15). Asked of Orders' ports and pure pricing -- never reimplemented here.
        var discount = settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent);
        var (_, quote) = await SubscriptionCheckout.QuoteAsync(
            inputsLoader, customerId, command.SkuId, command.Quantity, command.Fulfilment, command.DeliveryAddressId, command.PickupBranchId, command.PaymentMethod, discount, clock.Now, default);
        if (SubscriptionCheckout.TermsRefusal(quote, command.PaymentMethod) is { } refusal) return refusal;

        var subscription = new SubscriptionAggregate(command.SubscriptionId);
        try
        {
            subscription.Create(new CreateSubscriptionDto(
                customerId, command.SkuId, sku.ProductName, sku.VariantLabel, terms, command.FirstDeliveryOn, clock, command.UserContext!, command.CorrelationId));
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        SubscriptionNotifications.EnqueueCreated(outbox, links, subscription, command.CorrelationId, command.UserContext!);

        await subscriptions.SaveAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success(subscription.Id);
    }
}

/// <summary>HO-SUB-001 §11.4 C2 (US-SUB-02) -- change quantity, interval, fulfilment or payment method. <c>ExpectedVersion</c> (<c>409</c> on a stale screen); the
/// same servability checks as C1; the aggregate decides immediate versus scheduled and the answer names the date.</summary>
public sealed class ChangeSubscriptionTermsCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions,
    ICheckoutInputsLoader inputsLoader,
    ICommerceClock commerceClock,
    IBusinessSettings settings,
    INotificationOutbox outbox,
    INotificationLinkBuilder links)
    : ICommandHandlerAsync<ChangeSubscriptionTermsCommand>
{
    public async Task<CommandResponse> HandleAsync(ChangeSubscriptionTermsCommand command)
    {
        if (SubscriptionCaller.CustomerId(command) is not { } customerId) return NotFound();

        var subscription = await SubscriptionCaller.LoadOwnAsync(subscriptions, command.SubscriptionId, customerId);
        if (subscription is null) return NotFound();

        if (subscription.Version != command.ExpectedVersion)
            return Violation(BusinessViolationCodes.StaleVersion, nameof(command.ExpectedVersion), "This subscription was changed elsewhere. Reload it and try again.");

        SubscriptionTerms terms;
        try
        {
            terms = SubscriptionTerms.Create(command.Quantity, command.IntervalWeeks, command.Fulfilment, command.DeliveryAddressId, command.PickupBranchId, command.PaymentMethod);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        var clock = await commerceClock.GetAsync();
        var (_, quote) = await SubscriptionCheckout.QuoteAsync(
            inputsLoader, customerId, subscription.SkuId, command.Quantity, command.Fulfilment, command.DeliveryAddressId, command.PickupBranchId, command.PaymentMethod,
            settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent), clock.Now, default);
        // Only what orders depend on is re-checked: an interval-only change never fails because, say, COD has since been switched off for the zone.
        var servabilityChanged = terms.WithInterval(subscription.Terms.IntervalWeeks) != subscription.Terms;
        if (servabilityChanged && SubscriptionCheckout.TermsRefusal(quote, command.PaymentMethod) is { } refusal) return refusal;

        SubscriptionChangeOutcome outcome;
        try
        {
            outcome = subscription.ChangeTerms(terms, clock, command.UserContext!, command.CorrelationId);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        SubscriptionNotifications.EnqueueChanged(outbox, links, subscription, outcome.Message, command.CorrelationId, command.UserContext!);
        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success(outcome);
    }
}

/// <summary>HO-SUB-001 §11.4 C3 -- skip one delivery. A stale skip link is refused specifically (<c>CycleNoLongerSkippable</c>, naming the next skippable date).</summary>
public sealed class SkipSubscriptionDeliveryCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions, ICommerceClock commerceClock, INotificationOutbox outbox, INotificationLinkBuilder links)
    : ICommandHandlerAsync<SkipSubscriptionDeliveryCommand>
{
    public Task<CommandResponse> HandleAsync(SkipSubscriptionDeliveryCommand command) =>
        SubscriptionChangeFlow.RunAsync(subscriptions, commerceClock, outbox, links, command, command.SubscriptionId,
            (s, clock) => s.SkipDelivery(command.CycleOn, clock, command.UserContext!, command.CorrelationId));
}

/// <summary>HO-SUB-001 §11.4 C4 -- pause. Before the cut-off it pauses now; after it, the pause starts once the order already being prepared has gone.</summary>
public sealed class PauseSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions, ICommerceClock commerceClock, INotificationOutbox outbox, INotificationLinkBuilder links)
    : ICommandHandlerAsync<PauseSubscriptionCommand>
{
    public Task<CommandResponse> HandleAsync(PauseSubscriptionCommand command) =>
        SubscriptionChangeFlow.RunAsync(subscriptions, commerceClock, outbox, links, command, command.SubscriptionId,
            (s, clock) => s.Pause(clock, command.UserContext!, command.CorrelationId));
}

/// <summary>HO-SUB-001 §11.4 C5 -- resume a paused subscription. A customer cannot resume a <i>suspension</i> (<c>SubscriptionSuspended</c>, §8.9). Refused when the
/// product can no longer be bought, so the customer is told now rather than at the next cycle.</summary>
public sealed class ResumeSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions, ISubscribableCatalogue catalogue, ICommerceClock commerceClock, IBusinessSettings settings,
    INotificationOutbox outbox, INotificationLinkBuilder links)
    : ICommandHandlerAsync<ResumeSubscriptionCommand>
{
    public async Task<CommandResponse> HandleAsync(ResumeSubscriptionCommand command)
    {
        if (SubscriptionCaller.CustomerId(command) is not { } customerId) return NotFound();

        var subscription = await SubscriptionCaller.LoadOwnAsync(subscriptions, command.SubscriptionId, customerId);
        if (subscription is null) return NotFound();

        if (subscription.Status == SubscriptionStatus.Suspended)
            return Violation(BusinessViolationCodes.SubscriptionSuspended, nameof(command.SubscriptionId),
                SubscriptionMessages.SubscriptionSuspendedMessage(subscription.SuspensionReason, settings.GetInt(SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles)));

        var clock = await commerceClock.GetAsync();
        if (subscription.Status == SubscriptionStatus.Paused)
        {
            var skus = await catalogue.GetAsync([subscription.SkuId], clock.Now, default);
            if (!skus.TryGetValue(subscription.SkuId, out var sku) || !sku.IsPurchasable)
                return Violation(BusinessViolationCodes.SkuNotSubscribable, nameof(command.SubscriptionId), SubscriptionMessages.SkuNotSubscribableInactive);
        }

        return await SubscriptionChangeFlow.CompleteAsync(subscriptions, outbox, links, subscription, command,
            () => subscription.Resume(command.FirstDeliveryOn, clock, command.UserContext!, command.CorrelationId));
    }
}

/// <summary>HO-SUB-001 §11.4 C6 (US-SUB-02) -- cancel. A customer cancels their own (<c>404</c> otherwise); staff cancel any (<c>Subscriptions.Manage</c>, checked at the
/// edge) with <c>StaffCancelled</c> and a note. The customer is told when it ends; a locked cycle's order still goes (§8.5).</summary>
public sealed class CancelSubscriptionCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions, ICommerceClock commerceClock, INotificationOutbox outbox, INotificationLinkBuilder links)
    : ICommandHandlerAsync<CancelSubscriptionCommand>
{
    public async Task<CommandResponse> HandleAsync(CancelSubscriptionCommand command)
    {
        SubscriptionAggregate? subscription;
        if (command.ByStaff)
        {
            subscription = await subscriptions.GetByIdAsync(command.SubscriptionId);
        }
        else
        {
            if (SubscriptionCaller.CustomerId(command) is not { } customerId) return NotFound();
            subscription = await SubscriptionCaller.LoadOwnAsync(subscriptions, command.SubscriptionId, customerId);
        }

        if (subscription is null) return NotFound();

        var clock = await commerceClock.GetAsync();
        SubscriptionChangeOutcome outcome;
        try
        {
            outcome = subscription.Cancel(command.UserContext!.UserId, command.Reason, command.Note, clock, command.UserContext!, command.CorrelationId);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        SubscriptionNotifications.EnqueueCancelled(outbox, links, subscription, outcome, clock, command.CorrelationId, command.UserContext!);
        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success(outcome);
    }
}

/// <summary>HO-SUB-001 §11.4 C7 -- withdraw every scheduled change; <c>NoPendingChange</c> when there is none.</summary>
public sealed class WithdrawPendingSubscriptionChangesCommandHandler(
    IAggregateRootRepository<SubscriptionAggregate> subscriptions, ICommerceClock commerceClock, INotificationOutbox outbox, INotificationLinkBuilder links)
    : ICommandHandlerAsync<WithdrawPendingSubscriptionChangesCommand>
{
    public Task<CommandResponse> HandleAsync(WithdrawPendingSubscriptionChangesCommand command) =>
        SubscriptionChangeFlow.RunAsync(subscriptions, commerceClock, outbox, links, command, command.SubscriptionId,
            (s, clock) => s.WithdrawPendingChanges(clock, command.UserContext!, command.CorrelationId));
}

/// <summary>The shared shape of C3, C4, C5 and C7: own subscription (<c>404</c> otherwise), one mutation on the aggregate, the <c>subscription.changed</c> message,
/// the save, and the change answer. A rule violation is <b>returned</b>.</summary>
internal static class SubscriptionChangeFlow
{
    public static async Task<CommandResponse> RunAsync(
        IAggregateRootRepository<SubscriptionAggregate> subscriptions, ICommerceClock commerceClock, INotificationOutbox outbox, INotificationLinkBuilder links,
        Command command, Guid subscriptionId, Func<SubscriptionAggregate, SubscriptionClock, SubscriptionChangeOutcome> mutate)
    {
        if (SubscriptionCaller.CustomerId(command) is not { } customerId) return NotFound();

        var subscription = await SubscriptionCaller.LoadOwnAsync(subscriptions, subscriptionId, customerId);
        if (subscription is null) return NotFound();

        var clock = await commerceClock.GetAsync();
        return await CompleteAsync(subscriptions, outbox, links, subscription, command, () => mutate(subscription, clock));
    }

    public static async Task<CommandResponse> CompleteAsync(
        IAggregateRootRepository<SubscriptionAggregate> subscriptions, INotificationOutbox outbox, INotificationLinkBuilder links,
        SubscriptionAggregate subscription, Command command, Func<SubscriptionChangeOutcome> mutate)
    {
        SubscriptionChangeOutcome outcome;
        try
        {
            outcome = mutate();
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex);
        }

        SubscriptionNotifications.EnqueueChanged(outbox, links, subscription, outcome.Message, command.CorrelationId, command.UserContext!);
        await subscriptions.UpdateAsync(subscription, EventPublishOption.InMemoryPublishOnly);
        return Success(outcome);
    }
}
