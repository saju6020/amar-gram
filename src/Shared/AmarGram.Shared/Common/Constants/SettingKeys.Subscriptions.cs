namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §10.2 -- Subscriptions' registry keys (ADR-341 per-area partial). All global: none has a branch override.</summary>
public static partial class SettingKeys
{
    public const string SubscriptionChangeCutoffDays = "subscription.changeCutoffDays";
    public const string SubscriptionPreChargeNoticeDays = "subscription.preChargeNoticeDays";
    public const string SubscriptionDiscountPercent = "subscription.discountPercent";
    public const string SubscriptionPaymentReminderHours = "subscription.paymentReminderHours";
    public const string SubscriptionMaxConsecutiveUnpaidCycles = "subscription.maxConsecutiveUnpaidCycles";
}
