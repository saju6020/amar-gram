namespace AmarGram.Read.ViewModels;

/// <summary>HO-P4 BG-9 -- the cheapest and dearest CURRENT price among the product's active, priced SKUs (equal when there is one).</summary>
public sealed record StaffPriceRangeViewModel(MoneyViewModel Min, MoneyViewModel Max);

/// <summary>HO-SHP-001 section 12.4 -- staff product list (UI-4).
/// HO-P4 BG-9 adds, all additive and per product: <c>CountryOfOrigin</c> ({ code, name }, null when none), <c>PackSizes</c> (the size
/// labels of the active SKUs that have one, cheapest first; empty for a single unlabelled SKU), <c>PriceRange</c> (null when no active SKU
/// is priced now), <c>AvailableStock</c> (sum of the active SKUs' sellable quantity at the caller's ACTIVE branch, from
/// <c>inventory.v_sku_sellable</c>; null when there is no active branch, Inventory never reported the product, or it is a bundle -- a
/// bundle's own SKU holds no stock), <c>PrimaryImage</c> (the product's primary photo, else its first, with a signed 480 px thumbnail
/// <c>url</c> exactly as the shop read signs it; null when it has none) and <c>IsOrganic</c> (carries <c>CertifiedOrganic</c>).</summary>
public sealed record StaffProductSummaryViewModel(
    Guid ProductId,
    string Name,
    string Brand,
    string Category,
    string Status,
    string Kind,
    int SkuCount,
    bool ListedOnStorefront,
    DateTimeOffset LastUpdatedOn,
    CountryRef? CountryOfOrigin = null,
    IReadOnlyList<string>? PackSizes = null,
    StaffPriceRangeViewModel? PriceRange = null,
    decimal? AvailableStock = null,
    ProductImageRef? PrimaryImage = null,
    bool IsOrganic = false);
