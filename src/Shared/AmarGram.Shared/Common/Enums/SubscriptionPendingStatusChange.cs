namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1 -- a pause or cancellation made after the cut-off, applied once the locked cycle has been processed.</summary>
public sealed class SubscriptionPendingStatusChange(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionPendingStatusChange Pause = new(1, nameof(Pause));
    public static readonly SubscriptionPendingStatusChange Cancel = new(2, nameof(Cancel));
}
