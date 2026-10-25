namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SHP-001 §10.3 -- ProductAggregate's own field lengths and collection caps.</summary>
public static class ProductRules
{
    public const int MaxSkus = 100;
    public const int MaxImages = 40;
    public const int MaxTags = 20;
    /// <summary>HO-P2 §1.3: every certification at most once (there are four).</summary>
    public const int MaxCertifications = 4;

    public const int NameMaxLength = 200;
    public const int BrandMaxLength = 100;
    public const int DescriptionMaxLength = 5000;
    public const int SlugMaxLength = 120;
    public const int TagMaxLength = 40;
    public const int IngredientListMaxLength = 4000;
    public const int StorageInstructionsMaxLength = 1000;
    public const int ShelfLifeMaxLength = 100;
    public const int NetWeightMaxLength = 50;
    public const int AllergensMaxLength = 500;
    public const int OrganicCertifierMaxLength = 200;
    public const int OrganicCertificateNumberMaxLength = 100;

    /// <summary>HO-P4 BG-10 -- products per bulk publish/hide request.</summary>
    public const int MaxBulkProducts = 100;

    public const int SkuCodeMaxLength = 40;
    public const int BarcodeMinLength = 4;
    public const int BarcodeMaxLength = 32;
    public const int SizeOrWeightMaxLength = 50;
    public const int FlavourMaxLength = 80;
    public const int ColourMaxLength = 50;
    public const int MinPackQuantity = 1;
    public const int MaxPackQuantity = 999;
    /// <summary>Owner decision 2026-10-09: optional shipping weight per SKU, grams; 1 g to 100 kg.</summary>
    public const int MinShippingWeightGrams = 1;
    public const int MaxShippingWeightGrams = 100_000;

    public const int AltTextMaxLength = 200;
    public const long MaxImageSizeInBytes = 5_242_880;
}
