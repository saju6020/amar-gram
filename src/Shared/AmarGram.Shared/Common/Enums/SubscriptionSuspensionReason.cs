namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// HO-SUB-001 §10.1 -- why a subscription stopped raising orders by itself. Staff alone lift an <c>UnpaidCycles</c> suspension (OQ-6).
/// </summary>
public sealed class SubscriptionSuspensionReason(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionSuspensionReason UnpaidCycles = new(1, nameof(UnpaidCycles));
    public static readonly SubscriptionSuspensionReason ProductUnavailable = new(2, nameof(ProductUnavailable));
}
