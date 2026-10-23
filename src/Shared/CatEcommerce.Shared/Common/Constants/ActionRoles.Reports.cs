namespace CatEcommerce.Shared.Common.Constants;

/// <summary>
/// Reporting's own rows in the solution-wide action-to-role table (HO-RPT-001 section 8.8 / 12.3, ADR-281). Appendix D's "Reports" row: Inventory R (stock), Shop Manager R (sales),
/// Accountant F (financial) and, by owner decision 2026-10-13, sales too, Admin F. Reception holds no report action at all, so is outside <c>Reports.Any</c>.
/// </summary>
public static partial class ActionRoles
{
    private static readonly (string Action, string[] Roles)[] ReportsRows =
    [
        (Actions.Reports.StockView, [StaffRoles.Inventory, StaffRoles.Administrator]),
        (Actions.Reports.SalesView, [StaffRoles.ShopManager, StaffRoles.Accountant, StaffRoles.Administrator]),
        (Actions.Reports.FinancialView, [StaffRoles.Accountant, StaffRoles.Administrator]),
        (Actions.Reports.GrowthView, [StaffRoles.Administrator]),
        (Actions.Reports.Any, [StaffRoles.Inventory, StaffRoles.ShopManager, StaffRoles.Accountant, StaffRoles.Administrator]),
        (Actions.Reports.Schedule, [StaffRoles.Administrator]),
        (Actions.Dashboard.View, [StaffRoles.Reception, StaffRoles.Inventory, StaffRoles.ShopManager, StaffRoles.Accountant, StaffRoles.Administrator]),
    ];
}
