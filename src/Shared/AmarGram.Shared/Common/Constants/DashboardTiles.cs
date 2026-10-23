namespace AmarGram.Shared.Common.Constants;

/// <summary>One tile of the role dashboard (HO-RPT-001 section 8.11). <paramref name="GateAction"/> is the action the caller must hold: the tile is not even computed otherwise. <paramref name="DrillReportKey"/> is the report the tile opens, if any.</summary>
public sealed record DashboardTileDefinition(string Key, string Title, IReadOnlyList<string> Roles, string GateAction, string? DrillReportKey, IReadOnlyList<string>? AlternativeGateActions = null);

/// <summary>
/// HO-RPT-001 section 8.11 (ADR-286) -- the tiles each role sees, server-composed. Only the tiles whose source module is built are listed. Where an owning handover names no read action the gate falls back to the category action of section 8.8 (named in the ACCEPTANCE report): the
/// <c>revenue.*</c>, <c>payments.*</c>, <c>billing.*</c> and <c>orders.*</c> tiles use the report category action.
/// </summary>
public static class DashboardTiles
{
    public static readonly IReadOnlyList<DashboardTileDefinition> All =
    [
        new("stock.expiry", "Expiring stock", [StaffRoles.Inventory, StaffRoles.Administrator], Actions.Reports.StockView, ReportCatalogue.StockNearExpiryKey),
        new("stock.low", "Low stock", [StaffRoles.Inventory], Actions.Reports.StockView, ReportCatalogue.StockLowReorderKey),
        new("stock.consignments-open", "Consignments awaiting clearance", [StaffRoles.Inventory], Actions.Reports.StockView, ReportCatalogue.ImportConsignmentsKey),
        new("orders.today", "Orders today", [StaffRoles.ShopManager, StaffRoles.Administrator], Actions.Reports.SalesView, null),
        new("orders.awaiting-transfer", "Bank transfers awaited", [StaffRoles.ShopManager, StaffRoles.Accountant], Actions.Reports.SalesView, null, [Actions.Reports.FinancialView]),
        new("orders.returns-pending", "Returns to decide", [StaffRoles.ShopManager], Actions.Reports.SalesView, null),
        new("revenue.shop-today", "Shop revenue today", [StaffRoles.ShopManager], Actions.Reports.SalesView, ReportCatalogue.RevenueShopByCategoryKey),
        new("payments.today", "Payments today", [StaffRoles.Accountant, StaffRoles.Administrator], Actions.Reports.FinancialView, ReportCatalogue.PaymentReconciliationKey),
        new("payments.unreconciled", "Unreconciled payments", [StaffRoles.Accountant], Actions.Reports.FinancialView, ReportCatalogue.PaymentReconciliationKey),
        new("billing.cash-up", "Cash-up today", [StaffRoles.Accountant], Actions.Reports.FinancialView, ReportCatalogue.DailyCashUpKey),
        new("billing.receivables", "Receivables", [StaffRoles.Accountant, StaffRoles.Administrator], Actions.Reports.FinancialView, ReportCatalogue.ReceivablesAgeingKey),
        new("revenue.today-by-line", "Revenue today", [StaffRoles.Administrator], Actions.Reports.FinancialView, ReportCatalogue.RevenueByBusinessLineKey),
    ];

    /// <summary>The tiles for <paramref name="role"/>, in table order.</summary>
    public static IReadOnlyList<DashboardTileDefinition> ForRole(string role) => All.Where(t => t.Roles.Contains(role, StringComparer.Ordinal)).ToList();

    /// <summary>The union over the caller's roles, de-duplicated, in the order of the caller's first role in <see cref="StaffRoles.All"/> order.</summary>
    public static IReadOnlyList<DashboardTileDefinition> ForRoles(IEnumerable<string> roles)
    {
        var ordered = StaffRoles.All.Where(r => roles.Contains(r, StringComparer.Ordinal)).ToList();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        return ordered.SelectMany(ForRole).Where(t => seen.Add(t.Key)).ToList();
    }
}
