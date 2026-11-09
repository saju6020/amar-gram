using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §10.2 -- the five <c>subscription.*</c> settings, a new group "Subscriptions". Defaults are OQ-14's. The HO-ADM-002 settings screen
/// lists them with no frontend change; that screen is how the shop manager sets the subscriber discount (US-SUB-04). No migration (values are rows).</summary>
public static partial class SettingDefinitions
{
    private static readonly IReadOnlyList<SettingDefinition> SubscriptionsEntries =
    [
        new SettingDefinition(
            SettingKeys.SubscriptionChangeCutoffDays, "Subscriptions", SettingType.Integer, "0", "7", "days", "2",
            false, "Subscription change cut-off", "Days before a delivery date after which a subscription change waits for the following delivery (FR-SUB-3, US-SUB-02)."),

        new SettingDefinition(
            SettingKeys.SubscriptionPreChargeNoticeDays, "Subscriptions", SettingType.Integer, "1", "14", "days", "3",
            false, "Subscription notice lead", "Days before each delivery date that the customer is reminded; never later than one day before the cut-off (FR-SUB-4)."),

        new SettingDefinition(
            SettingKeys.SubscriptionDiscountPercent, "Subscriptions", SettingType.Decimal, "0.00", "50.00", "percent", "0.00",
            false, "Subscriber discount", "Percentage taken off every subscription order line, shown on the order (FR-SUB-5, US-SUB-04). 0 means none."),

        new SettingDefinition(
            SettingKeys.SubscriptionPaymentReminderHours, "Subscriptions", SettingType.Integer, "0", "168", "hours", "24",
            false, "Subscription payment reminder", "Hours before a held bank-transfer subscription order expires that the customer is reminded to pay. 0 turns the reminder off (US-SUB-06)."),

        new SettingDefinition(
            SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles, "Subscriptions", SettingType.Integer, "1", "6", "orders", "2",
            false, "Unpaid orders before suspension", "Consecutive subscription orders left unpaid (expired or refused) before the subscription is suspended (US-SUB-06)."),
    ];
}
