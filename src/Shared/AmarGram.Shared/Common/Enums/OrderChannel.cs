namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-ORD-001 §10.1. Append-only. HO-SUB-001 §3 adds <c>Subscription</c> (an order raised by the subscription worker; online-style payment and fulfilment).</summary>
public sealed class OrderChannel(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly OrderChannel Online = new(1, nameof(Online));
    public static readonly OrderChannel Counter = new(2, nameof(Counter));
    public static readonly OrderChannel Subscription = new(3, nameof(Subscription));
}
