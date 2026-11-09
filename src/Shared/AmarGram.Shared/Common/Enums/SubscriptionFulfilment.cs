namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1 -- how each cycle's order reaches the customer.</summary>
public sealed class SubscriptionFulfilment(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionFulfilment Delivery = new(1, nameof(Delivery));
    public static readonly SubscriptionFulfilment Pickup = new(2, nameof(Pickup));
}
