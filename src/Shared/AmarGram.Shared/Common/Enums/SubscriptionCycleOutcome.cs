namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1 -- what happened when a cycle's date arrived: an order was raised, or the attempt failed and the cycle was consumed.</summary>
public sealed class SubscriptionCycleOutcome(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionCycleOutcome Generated = new(1, nameof(Generated));
    public static readonly SubscriptionCycleOutcome Failed = new(2, nameof(Failed));
}
