namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §8.12, adapted (the authorisation reason is retired with the clinic, HO-P1) -- why a cycle raised no order.</summary>
public sealed class SubscriptionCycleFailureReason(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionCycleFailureReason OutOfStock = new(1, nameof(OutOfStock));
    public static readonly SubscriptionCycleFailureReason ProductUnavailable = new(2, nameof(ProductUnavailable));
    public static readonly SubscriptionCycleFailureReason PaymentMethodUnavailable = new(3, nameof(PaymentMethodUnavailable));
    public static readonly SubscriptionCycleFailureReason DeliveryUnavailable = new(4, nameof(DeliveryUnavailable));
    public static readonly SubscriptionCycleFailureReason DeliveryAddressMissing = new(5, nameof(DeliveryAddressMissing));
    public static readonly SubscriptionCycleFailureReason OrderRefused = new(6, nameof(OrderRefused));
}
