namespace AmarGram.Read.ViewModels;

public sealed record FoodDetailViewModel(
    string? IngredientList, string? StorageInstructions, string? ShelfLife, string? NetWeight, string? Allergens,
    string? OrganicCertifier, string? OrganicCertificateNumber);

public sealed record ExpiryNoticeViewModel(DateOnly ExpiresOn);

public sealed record DetailSkuViewModel(
    Guid SkuId, string Code, string Label, string? SizeOrWeight, string? Flavour, string? Colour, int? PackQuantity,
    MoneyViewModel? Price, string Availability, ExpiryNoticeViewModel? ExpiryNotice, IReadOnlyList<ProductImageRef> Images,
    // HO-P4 BG-13: the compare-at ("Was") price of the current price; null when none.
    MoneyViewModel? CompareAtPrice = null);

public sealed record ProductDetailViewModel(
    Guid ProductId, string Slug, string Name, string Brand, string Description, string Category, string? Subcategory,
    IReadOnlyList<string> Tags, IReadOnlyList<string> Certifications, string Kind, CountryRef? CountryOfOrigin,
    FoodDetailViewModel? Food, IReadOnlyList<ProductImageRef> Images, IReadOnlyList<DetailSkuViewModel> Skus,
    RatingSummary Rating, bool PricesIncludeTax, string Locale, IReadOnlyDictionary<string, string> FieldLocales,
    BundleDetailViewModel? Bundle = null);
