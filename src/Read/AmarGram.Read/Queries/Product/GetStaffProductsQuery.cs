using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Product;

/// <summary>HO-SHP-001 section 12.4.</summary>
public sealed class GetStaffProductsQuery : Query<PagedResult<StaffProductSummaryViewModel>>
{
    public string? Q { get; init; }
    public string? Status { get; init; }
    public string? Category { get; init; }
    public string? Brand { get; init; }
    public string? Barcode { get; init; }
    public string? Kind { get; init; }
    public bool? Listed { get; init; }
    public string? Sort { get; init; }

    /// <summary>HO-P4 BG-9 -- the caller's ACTIVE branch (the controller resolves it; null when the caller has none), for the stock figure only.</summary>
    public Guid? BranchId { get; init; }

    /// <summary>HO-P4 BG-9 -- false skips the per-page extras (pack sizes, price range, stock, thumbnail); the CSV export of up to 50,000 rows does not use them.</summary>
    public bool IncludeExtras { get; init; } = true;
}
