namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-ORD-001 §10.1. A SKU's category class for BR-10 return eligibility: opened food and used
/// household or care items are not returnable unless faulty or recalled.</summary>
public sealed class ProductReturnClass(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly ProductReturnClass Food = new(1, nameof(Food));
    public static readonly ProductReturnClass Household = new(2, nameof(Household));
    public static readonly ProductReturnClass Other = new(3, nameof(Other));

    /// <summary>The return class of a product category (food first, by <see cref="ProductCategory.IsFood"/>).</summary>
    public static ProductReturnClass Of(ProductCategory category) =>
        category.IsFood ? Food : category == ProductCategory.HouseholdAndCare ? Household : Other;
}
