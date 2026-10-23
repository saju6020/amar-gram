namespace CatEcommerce.Shared.Common.Constants;

/// <summary>
/// Reporting (HO-RPT-001 section 12.3, ADR-281) action names. One action per report category, mapped from Appendix D's "Reports" row. <see cref="Reports.Any"/> is the marker every
/// <c>/api/staff/reports/**</c> endpoint carries -- the route carries <c>{reportKey}</c>, so the report's own category action is enforced in the query handler by
/// <c>ReportAccessPolicy</c> with the same 403 shape.
/// </summary>
public static partial class Actions
{
    public static class Reports
    {
        public const string StockView = "Reports.Stock.View";
        public const string SalesView = "Reports.Sales.View";
        public const string FinancialView = "Reports.Financial.View";
        public const string GrowthView = "Reports.Growth.View";
        public const string Any = "Reports.Any";
        public const string Schedule = "Reports.Schedule";
    }

    public static class Dashboard
    {
        public const string View = "Dashboard.View";
    }
}
