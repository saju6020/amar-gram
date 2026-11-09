using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-ADM-001 §10.2 -- the settings this handover itself specifies (HO-P1 removed the retired areas' ones).
/// </summary>
public static partial class SettingDefinitions
{
    private static readonly IReadOnlyList<SettingDefinition> AdministrationEntries =
    [
        new SettingDefinition(
            SettingKeys.InventoryExpiryAlertDays, "Inventory", SettingType.Integer, "1", "365", "days", "60",
            true, "Expiry alert window", "Days before expiry a batch is flagged for attention (HO-IMP)."),

        new SettingDefinition(
            SettingKeys.InventoryDefaultReorderPoint, "Inventory", SettingType.Integer, "0", "100000", "units", "10",
            true, "Default reorder point", "Default reorder point for a new SKU location (HO-IMP)."),

        new SettingDefinition(
            SettingKeys.NotificationsQuietHours, "Notifications", SettingType.TimeRange, null, null, null, "21:00-08:00",
            true, "Quiet hours", "Local time window during which non-urgent notifications are held (HO-NTF, FR-NTF-5)."),

        new SettingDefinition(
            SettingKeys.SecurityStaffIdleTimeoutMinutes, "Security", SettingType.Integer, "5", "240", "minutes", "30",
            false, "Staff idle timeout", "Minutes of staff inactivity before a session is treated as idle (HO-ACC, rewired here)."),

        new SettingDefinition(
            SettingKeys.CommerceCurrencyCode, "Commerce", SettingType.CurrencyCode, null, null, null, "BDT",
            false, "Currency code", "The ISO-4217 currency code money is denominated in (ADR-054)."),
    ];
}
