namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1, ADR-243 -- the mirror of a cycle's order, updated from Orders' events. Orders is the authority; this is never a decision.</summary>
public sealed class SubscriptionCycleOrderState(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionCycleOrderState AwaitingPayment = new(1, nameof(AwaitingPayment));
    public static readonly SubscriptionCycleOrderState Confirmed = new(2, nameof(Confirmed));
    public static readonly SubscriptionCycleOrderState Expired = new(3, nameof(Expired));
    public static readonly SubscriptionCycleOrderState Cancelled = new(4, nameof(Cancelled));
    public static readonly SubscriptionCycleOrderState Delivered = new(5, nameof(Delivered));
    public static readonly SubscriptionCycleOrderState Refused = new(6, nameof(Refused));
}
