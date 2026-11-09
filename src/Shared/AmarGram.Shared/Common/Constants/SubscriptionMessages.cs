using System.Globalization;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-SUB-001 §8.11 (NFR-USA-4) -- the plain, actionable text of Subscriptions' refusals and messages, shared between an aggregate or handler pre-check and
/// the corresponding race path in <c>UniqueConstraintExceptionFilter</c> so the two cannot drift. Display text only: none of it carries a decision
/// (HO-NTF-001 rule 4). Dates are local dates in the commerce zone, formatted <c>ddd d MMM</c>.
/// </summary>
public static class SubscriptionMessages
{
    public const string SubscriptionAlreadyExists = "You already have a subscription for this product. You can change it from your subscriptions.";
    public const string SubscriptionLimitReached = "You have reached the limit of live subscriptions. Cancel one to start another.";
    public const string NoChangeRequested = "Nothing was changed - these are already the terms of your subscription.";
    public const string NoPendingChange = "There is no scheduled change to withdraw.";
    public const string SkuNotSubscribableInactive = "This product is not available to subscribe to right now.";
    public const string SkuNotSubscribableNotOffered = "This product is not offered as a subscription.";
    public const string ReinstatementReasonRequired = "Give a reason for restarting this subscription.";
    /// <summary>The label the subscriber discount carries on the order's line and in its discount text (HO-SUB-001 §4.2, US-SUB-04).</summary>
    public const string DiscountLabel = "Subscription discount";

    /// <summary><c>Subscription discount (10%)</c> -- the label an order or invoice shows for the subscriber discount; the plain <see cref="DiscountLabel"/> when the percentage is unknown.</summary>
    public static string DiscountLabelWith(decimal? percent) =>
        percent is { } p and > 0m ? $"{DiscountLabel} ({p.ToString("0.##", CultureInfo.InvariantCulture)}%)" : DiscountLabel;

    public const string EstimateNote = "Delivery and tax are added when each order is placed.";

    /// <summary><c>Tue 20 Oct</c>.</summary>
    public static string Day(DateOnly date) => date.ToString("ddd d MMM", CultureInfo.InvariantCulture);

    /// <summary><c>Thu 22 Oct 2026, 10:30</c> -- an instant already converted to the commerce zone.</summary>
    public static string DayTime(DateTime local) => local.ToString("ddd d MMM yyyy, HH:mm", CultureInfo.InvariantCulture);

    public static string TransitionNotAllowed(SubscriptionStatus status, string action) =>
        $"A {status.DisplayName.ToLowerInvariant()} subscription cannot be {action}.";

    public static string SubscriptionSuspendedMessage(SubscriptionSuspensionReason? reason, int maxUnpaid) =>
        reason == SubscriptionSuspensionReason.UnpaidCycles
            ? $"This subscription was paused after {maxUnpaid} unpaid {(maxUnpaid == 1 ? "order" : "orders")}. Please contact the shop to restart it."
            : "This subscription was paused because the product is no longer available. Please contact the shop.";

    public static string SuspensionReasonText(SubscriptionSuspensionReason reason, int maxUnpaid) => SubscriptionSuspendedMessage(reason, maxUnpaid);

    public static string CycleNoLongerSkippable(DateOnly requested, DateOnly? nextSkippable) =>
        nextSkippable is { } next
            ? $"The delivery on {Day(requested)} can no longer be skipped. You can skip the one on {Day(next)}."
            : $"The delivery on {Day(requested)} can no longer be skipped.";

    public static string FailureReasonText(SubscriptionCycleFailureReason reason) =>
        reason == SubscriptionCycleFailureReason.OutOfStock ? "It was out of stock, so no order was placed. Your next delivery stays on schedule."
        : reason == SubscriptionCycleFailureReason.ProductUnavailable ? "The product is no longer available, so your subscription has been paused."
        : reason == SubscriptionCycleFailureReason.PaymentMethodUnavailable ? "Your payment method is not available for this order. Please choose another in your subscription."
        : reason == SubscriptionCycleFailureReason.DeliveryUnavailable ? "We could not deliver to your chosen address or collection point. Please check your subscription."
        : reason == SubscriptionCycleFailureReason.DeliveryAddressMissing ? "Your delivery address is no longer in your address book. Please choose another in your subscription."
        : "We could not place the order. Please contact the shop.";

    public static string PaymentMethodText(SubscriptionPaymentMethod method) =>
        method == SubscriptionPaymentMethod.CashOnDelivery ? "Cash on delivery"
        : method == SubscriptionPaymentMethod.BankTransfer ? "Bank transfer"
        : "Pay at the shop on collection";

    public static string IntervalText(int weeks) => $"every {weeks} weeks";
}
