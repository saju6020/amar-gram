using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-SUB-001 §8.12 -- the refusal mapping, pure. Orders' refusal codes (as this codebase's checkout names them) map to
/// <see cref="SubscriptionCycleFailureReason"/>; an unknown code is <c>OrderRefused</c> and its raw text is kept in <c>FailureCode</c> for support.
/// </summary>
public static class SubscriptionFailureClassifier
{
    public static SubscriptionCycleFailureReason Classify(string? ordersCode) => ordersCode switch
    {
        BusinessViolationCodes.StockNoLongerAvailable or BusinessViolationCodes.InsufficientStock or BusinessViolationCodes.SkuUnavailable => SubscriptionCycleFailureReason.OutOfStock,
        BusinessViolationCodes.SkuNotPurchasable => SubscriptionCycleFailureReason.ProductUnavailable,
        BusinessViolationCodes.PaymentMethodUnavailable => SubscriptionCycleFailureReason.PaymentMethodUnavailable,
        BusinessViolationCodes.AddressOutsideServedZones or BusinessViolationCodes.PickupBranchUnavailable or BusinessViolationCodes.ServiceLevelUnavailable
            or BusinessViolationCodes.DeliveryTaxNotConfigured => SubscriptionCycleFailureReason.DeliveryUnavailable,
        BusinessViolationCodes.DeliveryAddressNotFound => SubscriptionCycleFailureReason.DeliveryAddressMissing,
        _ => SubscriptionCycleFailureReason.OrderRefused,
    };

    /// <summary>A failure of these reasons also suspends the subscription (§8.6 step 6): nothing will change by trying again.</summary>
    public static SubscriptionSuspensionReason? SuspensionFor(SubscriptionCycleFailureReason reason) =>
        reason == SubscriptionCycleFailureReason.ProductUnavailable ? SubscriptionSuspensionReason.ProductUnavailable : null;
}
