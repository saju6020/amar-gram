namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1 -- exactly <c>.ai/enumeration-pattern.md</c>'s four states (SRS Appendix C).</summary>
public sealed class SubscriptionStatus(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionStatus Active = new(1, nameof(Active));
    public static readonly SubscriptionStatus Paused = new(2, nameof(Paused));
    public static readonly SubscriptionStatus Suspended = new(3, nameof(Suspended));
    public static readonly SubscriptionStatus Cancelled = new(4, nameof(Cancelled));
}
