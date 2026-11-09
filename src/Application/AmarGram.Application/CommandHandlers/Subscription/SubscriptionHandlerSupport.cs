using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Subscription;

/// <summary>Shared <c>CommandResponse</c> shapes for every Subscriptions handler (ADR-014): an expected business outcome is <b>returned</b>, never thrown, and
/// never published as a rejection event.</summary>
public static class SubscriptionResults
{
    public static CommandResponse Violation(string code, string property, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: "Subscription");
        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }

    public static CommandResponse Success(object? result = null) => new() { IsSuccess = true, Result = result! };

    public static CommandResponse NotFound() => Violation(BusinessViolationCodes.SubscriptionNotFound, "SubscriptionId", "That subscription was not found.");

    public static CommandResponse FromRule(DomainRuleViolationException ex) => Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
}

/// <summary>Who is acting: the signed-in customer (HO-SUB-001 §11.4 -- every customer handler resolves the subscription by id <b>and</b> caller, so someone else's
/// is the same <c>404</c> as one that does not exist).</summary>
internal static class SubscriptionCaller
{
    public static Guid? CustomerId(Command command) =>
        command.UserContext is { UserId: var id } user && id != Guid.Empty && user.Roles.Contains("Customer", StringComparer.Ordinal) ? id : null;

    public static async Task<SubscriptionAggregate?> LoadOwnAsync(IAggregateRootRepository<SubscriptionAggregate> subscriptions, Guid subscriptionId, Guid customerId) =>
        await subscriptions.GetByFilterAsync(s => s.Id == subscriptionId && s.CustomerId == customerId);
}

/// <summary>
/// HO-SUB-001 §12.8 (C-ORD-2, adapted) -- the checkout quote of one subscription cycle, built from Ordering's own ports and pure pricing, so the BR-15
/// decision (COD per zone and ceiling), the delivery zone, the tax and the pickup branch are <b>asked of Orders' rules, never reimplemented</b>. Used before
/// subscribing, when terms change, by the payment-methods read and by the order handler itself.
/// </summary>
public static class SubscriptionCheckout
{
    public static FulfilmentChoice ChoiceOf(SubscriptionFulfilment fulfilment, Guid? addressId, Guid? branchId, SubscriptionPaymentMethod method) =>
        new(fulfilment == SubscriptionFulfilment.Delivery ? FulfilmentMethod.Delivery : FulfilmentMethod.Pickup, addressId, null, null, null, branchId,
            method.ToOrderPaymentMethod(), null);

    public static async Task<(CheckoutInputs Inputs, CheckoutQuote Quote)> QuoteAsync(
        ICheckoutInputsLoader loader, Guid customerId, Guid skuId, int quantity, SubscriptionFulfilment fulfilment, Guid? addressId, Guid? branchId,
        SubscriptionPaymentMethod method, decimal discountPercent, DateTimeOffset now, CancellationToken ct)
    {
        var inputs = await loader.LoadSubscriptionAsync(
            customerId, [new CounterLineRequest(skuId, quantity)], ChoiceOf(fulfilment, addressId, branchId, method), discountPercent, now, ct);
        return (inputs, CheckoutPricing.Quote(inputs));
    }

    /// <summary>The reasons that make the <i>terms</i> unservable, as opposed to a passing stock-out: refused when subscribing or changing terms.</summary>
    private static readonly string[] TermsBlockingCodes =
    [
        BusinessViolationCodes.DeliveryAddressNotFound, BusinessViolationCodes.AddressOutsideServedZones, BusinessViolationCodes.ServiceLevelUnavailable,
        BusinessViolationCodes.PickupBranchUnavailable, BusinessViolationCodes.DeliveryTaxNotConfigured, BusinessViolationCodes.PaymentMethodUnavailable,
    ];

    /// <summary>Null when the terms can be served; else the refusal (Orders' own code and, for a payment method, Orders' own reason text).</summary>
    public static CommandResponse? TermsRefusal(CheckoutQuote quote, SubscriptionPaymentMethod method)
    {
        var code = TermsBlockingCodes.FirstOrDefault(quote.BlockingReasons.Contains);
        if (code is null) return null;

        if (code == BusinessViolationCodes.PaymentMethodUnavailable)
        {
            var message = quote.PaymentOptions.FirstOrDefault(o => o.Method == method.ToOrderPaymentMethod())?.Message ?? OrderMessages.PaymentMethodUnavailable;
            return SubscriptionResults.Violation(code, "PaymentMethod", message);
        }

        return code switch
        {
            BusinessViolationCodes.DeliveryAddressNotFound => SubscriptionResults.Violation(code, "DeliveryAddressId", "Choose a delivery address from your address book."),
            BusinessViolationCodes.AddressOutsideServedZones => SubscriptionResults.Violation(code, "DeliveryAddressId", OrderMessages.AddressOutsideServedZones),
            BusinessViolationCodes.PickupBranchUnavailable => SubscriptionResults.Violation(code, "PickupBranchId", "That branch is not available for collection."),
            BusinessViolationCodes.DeliveryTaxNotConfigured => SubscriptionResults.Violation(code, "Fulfilment", OrderMessages.DeliveryTaxNotConfigured),
            _ => SubscriptionResults.Violation(code, "Fulfilment", "That delivery option is not available for this address."),
        };
    }
}

/// <summary>
/// HO-SUB-001 §8.11 (ADR-245, ADR-246) -- builds and enqueues the subscription messages. Called from a <b>command handler, before its save</b>, through
/// <see cref="INotificationOutbox"/> (HO-NTF-001 ADR-056/057) -- never from a domain event handler. The customer is always the recipient. Every dynamic value
/// is display text; no free text (a note, a reason, an address) ever goes into a variable.
/// </summary>
public static class SubscriptionNotifications
{
    private static Guid Branch => AdministrationSeed.MainBranchId;

    public static void EnqueueCreated(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, Guid correlationId, UserContext user) =>
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionCreated, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["quantity"] = s.Terms.Quantity.ToString(System.Globalization.CultureInfo.InvariantCulture),
                ["intervalText"] = SubscriptionMessages.IntervalText(s.Terms.IntervalWeeks),
                ["firstDeliveryOn"] = SubscriptionMessages.Day(s.StartedOn),
                ["paymentMethodText"] = SubscriptionMessages.PaymentMethodText(s.Terms.PaymentMethod),
                ["manageLink"] = links.SubscriptionLink(s.Id),
            },
            BranchId: Branch, DeduplicationKey: $"subscription.created:{s.Id:N}", CorrelationId: correlationId, UserContext: user));

    public static void EnqueueChanged(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, string changeMessage, Guid correlationId, UserContext user) =>
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionChanged, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["changeMessage"] = changeMessage,
                ["manageLink"] = links.SubscriptionLink(s.Id),
            },
            BranchId: Branch, CorrelationId: correlationId, UserContext: user));

    public static void EnqueueCancelled(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, SubscriptionChangeOutcome outcome, SubscriptionClock clock, Guid correlationId, UserContext user)
    {
        var ends = outcome.AppliedImmediately ? "now" : $"after your delivery on {SubscriptionMessages.Day(outcome.AppliesFromCycleOn!.Value)}";
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionCancelled, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["endsText"] = ends,
                ["subscriptionsLink"] = links.SubscriptionsLink(),
            },
            BranchId: Branch, CorrelationId: correlationId, UserContext: user));
    }

    public static void EnqueueCycleFailed(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, DateOnly cycleOn, SubscriptionCycleFailureReason reason, Guid correlationId, UserContext user) =>
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionCycleFailed, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["cycleOn"] = SubscriptionMessages.Day(cycleOn),
                ["reasonText"] = SubscriptionMessages.FailureReasonText(reason),
                ["manageLink"] = links.SubscriptionLink(s.Id),
            },
            BranchId: Branch, DeduplicationKey: $"subscription.cycle-failed:{s.Id:N}:{cycleOn:yyyyMMdd}", CorrelationId: correlationId, UserContext: user));

    public static void EnqueueSuspended(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, int maxUnpaid, Guid correlationId, UserContext user) =>
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionSuspended, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["reasonText"] = SubscriptionMessages.SuspensionReasonText(s.SuspensionReason ?? SubscriptionSuspensionReason.UnpaidCycles, maxUnpaid),
                ["manageLink"] = links.SubscriptionLink(s.Id),
            },
            BranchId: Branch, DeduplicationKey: $"subscription.suspended:{s.Id:N}:{s.SuspendedOn:yyyyMMddHHmm}", CorrelationId: correlationId, UserContext: user));

    public static void EnqueueResumed(INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, Guid correlationId, UserContext user) =>
        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionResumed, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["nextDeliveryOn"] = s.NextDeliveryOn is { } next ? SubscriptionMessages.Day(next) : "soon",
                ["manageLink"] = links.SubscriptionLink(s.Id),
            },
            BranchId: Branch, CorrelationId: correlationId, UserContext: user));

    /// <summary>§8.9 -- <c>SendAfter = expiry - hours</c> (not enqueued if that is already past), <c>NotAfter = expiry</c>, guarded by the mirrored
    /// <c>AwaitingPayment</c>. Returns whether a reminder was queued.</summary>
    public static bool EnqueuePaymentReminder(
        INotificationOutbox outbox, INotificationLinkBuilder links, SubscriptionAggregate s, SubscriptionCycleAggregate cycle, decimal amountDue, string currencyCode,
        int reminderHours, SubscriptionClock clock, Guid correlationId, UserContext user)
    {
        if (reminderHours <= 0 || cycle.PaymentExpiresOn is not { } expiry || cycle.OrderId is not { } orderId) return false;

        var sendAfter = expiry.AddHours(-reminderHours);
        if (sendAfter <= clock.Now) return false;

        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.SubscriptionPaymentReminder, NotificationRecipientKind.Customer, s.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = s.Product.ProductName,
                ["amountDue"] = BillingMessages.FormatMoney(amountDue, currencyCode),
                ["payByLocal"] = SubscriptionMessages.DayTime(clock.LocalTimeOf(expiry)),
                ["orderLink"] = links.OrderLink(orderId),
            },
            SubjectKind: NotificationSubjectKind.SubscriptionOrderAwaitingPayment, SubjectId: cycle.Id, BranchId: Branch,
            DeduplicationKey: $"subscription.payment-reminder:{cycle.Id:N}", NotAfter: expiry, CorrelationId: correlationId, UserContext: user, SendAfter: sendAfter));
        return true;
    }
}
