namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SHP-001 §8.2/§10.1 -- FR-SHP-1's two-level taxonomy, top level. Code-defined
/// (ADR-078): adding a category is an SRS change (OQ-18), not an admin action. HO-P2 §1.1 redefined
/// the set for the Amar Gram catalogue.
///
/// <see cref="IsFood"/> is an explicit rule on each member (HO-P2 §1.1), never "is this one value":
/// it drives expiry tracking, the country-of-origin and labelling publish checks, food details, the
/// return class, <c>StockClass.Food</c> and the origins query.</summary>
public sealed class ProductCategory(int value, string displayName, bool isFood) : Enumeration(value, displayName)
{
    public bool IsFood { get; } = isFood;

    public static readonly ProductCategory RiceAndGrains = new(1, nameof(RiceAndGrains), isFood: true);
    public static readonly ProductCategory HoneyAndGur = new(2, nameof(HoneyAndGur), isFood: true);
    public static readonly ProductCategory OilsAndGhee = new(3, nameof(OilsAndGhee), isFood: true);
    public static readonly ProductCategory Spices = new(4, nameof(Spices), isFood: true);
    public static readonly ProductCategory Pulses = new(5, nameof(Pulses), isFood: true);
    public static readonly ProductCategory TeaAndDrinks = new(6, nameof(TeaAndDrinks), isFood: true);
    public static readonly ProductCategory FreshProduce = new(7, nameof(FreshProduce), isFood: true);
    public static readonly ProductCategory DatesAndDryFruit = new(8, nameof(DatesAndDryFruit), isFood: true);
    public static readonly ProductCategory DairyAndEggs = new(9, nameof(DairyAndEggs), isFood: true);
    public static readonly ProductCategory SnacksAndSweets = new(10, nameof(SnacksAndSweets), isFood: true);
    public static readonly ProductCategory HouseholdAndCare = new(11, nameof(HouseholdAndCare), isFood: false);

    /// <summary>The persisted values of every food category, for SQL predicates. A property, not a field:
    /// <see cref="Enumeration.GetAll{T}"/> reads the public static fields.</summary>
    public static IReadOnlyList<int> FoodValues => GetAll<ProductCategory>().Where(c => c.IsFood).Select(c => c.Value).ToList();
}
