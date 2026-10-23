using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>One cell of the Appendix D matrix -- HO-ACC-001 §10.2.</summary>
public sealed record StaffCapabilityCell(string Capability, string RoleId, CapabilityAccess Access, string? Qualifier = null);

/// <summary>
/// The Appendix D capability rows (`docs/SRS.md` Appendix D) x the staff roles
/// (<see cref="StaffRoles"/>), as read-only code-defined data (ADR-036) -- served by
/// <c>GET /api/staff-roles</c>. The <c>Customer</c> column of Appendix D is not represented:
/// <c>Customer</c> is not a staff role.
/// </summary>
public static class StaffRoleCatalogue
{
    public const string ProductCatalogue = "Product catalogue";
    public const string StockAndBatches = "Stock & batches";
    public const string PurchaseOrdersImports = "Purchase orders / imports";
    public const string OrdersAndFulfilment = "Orders & fulfilment";
    public const string InvoicesAndPayments = "Invoices & payments";
    public const string RefundsAndCreditNotes = "Refunds & credit notes";
    public const string Reports = "Reports";
    public const string StaffAndPermissions = "Staff & permissions";
    public const string SystemConfiguration = "System configuration";
    public const string AuditLog = "Audit log";

    public static readonly IReadOnlyList<string> Capabilities =
    [
        ProductCatalogue, StockAndBatches, PurchaseOrdersImports, OrdersAndFulfilment, InvoicesAndPayments,
        RefundsAndCreditNotes, Reports, StaffAndPermissions, SystemConfiguration, AuditLog
    ];

    private static readonly CapabilityAccess None = CapabilityAccess.None;
    private static readonly CapabilityAccess R = CapabilityAccess.ReadOnly;
    private static readonly CapabilityAccess W = CapabilityAccess.CreateEdit;
    private static readonly CapabilityAccess F = CapabilityAccess.Full;

    /// <summary>Row(capability, Reception, Inventory, ShopManager, Accountant, Administrator).</summary>
    private static readonly (string Capability, CapabilityAccess Reception, CapabilityAccess Inventory, CapabilityAccess ShopManager,
        CapabilityAccess Accountant, CapabilityAccess Administrator, string? Qualifier)[] Rows =
    [
        (ProductCatalogue, R, R, F, None, F, null),
        (StockAndBatches, R, F, R, None, F, null),
        (PurchaseOrdersImports, None, F, R, R, F, null),
        (OrdersAndFulfilment, W, R, F, R, F, null),
        (InvoicesAndPayments, W, None, W, F, F, null),
        (RefundsAndCreditNotes, None, None, W, F, F, null),
        (StaffAndPermissions, None, None, None, None, F, null),
        (SystemConfiguration, None, None, None, None, F, null),
        (AuditLog, None, None, None, R, F, null),
    ];

    // "Reports" carries a per-role qualifier (stock/sales/financial), so it
    // is expanded separately rather than forced into the uniform tuple shape above.
    private static readonly (string RoleId, CapabilityAccess Access, string? Qualifier)[] ReportsRow =
    [
        (StaffRoles.Reception, None, null),
        (StaffRoles.Inventory, R, "stock"),
        (StaffRoles.ShopManager, R, "sales"),
        (StaffRoles.Accountant, F, "financial"),
        (StaffRoles.Administrator, F, null),
    ];

    /// <summary>Every capability x every staff role.</summary>
    public static readonly IReadOnlyList<StaffCapabilityCell> Cells = BuildCells();

    private static List<StaffCapabilityCell> BuildCells()
    {
        var cells = new List<StaffCapabilityCell>();
        foreach (var row in Rows)
        {
            cells.Add(new StaffCapabilityCell(row.Capability, StaffRoles.Reception, row.Reception));
            cells.Add(new StaffCapabilityCell(row.Capability, StaffRoles.Inventory, row.Inventory));
            cells.Add(new StaffCapabilityCell(row.Capability, StaffRoles.ShopManager, row.ShopManager));
            cells.Add(new StaffCapabilityCell(row.Capability, StaffRoles.Accountant, row.Accountant));
            cells.Add(new StaffCapabilityCell(row.Capability, StaffRoles.Administrator, row.Administrator));
        }

        foreach (var (roleId, access, qualifier) in ReportsRow)
            cells.Add(new StaffCapabilityCell(Reports, roleId, access, qualifier));

        return cells;
    }
}
