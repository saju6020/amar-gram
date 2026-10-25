namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SUB-001 §10.1, adapted (no authorisation trigger, HO-P1) -- who or what restarted a subscription.</summary>
public sealed class SubscriptionResumeTrigger(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionResumeTrigger Customer = new(1, nameof(Customer));
    public static readonly SubscriptionResumeTrigger StaffReinstatement = new(2, nameof(StaffReinstatement));
}
