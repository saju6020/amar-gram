namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-SHP-001 §8.2/§10.1 -- FR-SHP-1's two-level taxonomy, second level (HO-P2 §1.2). Each
/// member carries its own <see cref="Category"/> parent; a product's subcategory must belong to its own
/// category (<c>InvalidProductCategory</c>).</summary>
public sealed class ProductSubcategory(int value, string displayName, ProductCategory category) : Enumeration(value, displayName)
{
    public ProductCategory Category { get; } = category;

    public static readonly ProductSubcategory AromaticRice = new(1, nameof(AromaticRice), ProductCategory.RiceAndGrains);
    public static readonly ProductSubcategory EverydayRice = new(2, nameof(EverydayRice), ProductCategory.RiceAndGrains);
    public static readonly ProductSubcategory FlattenedAndPuffedRice = new(3, nameof(FlattenedAndPuffedRice), ProductCategory.RiceAndGrains);
    public static readonly ProductSubcategory Flour = new(4, nameof(Flour), ProductCategory.RiceAndGrains);

    public static readonly ProductSubcategory Honey = new(5, nameof(Honey), ProductCategory.HoneyAndGur);
    public static readonly ProductSubcategory DateMolasses = new(6, nameof(DateMolasses), ProductCategory.HoneyAndGur);
    public static readonly ProductSubcategory SugarcaneGur = new(7, nameof(SugarcaneGur), ProductCategory.HoneyAndGur);

    public static readonly ProductSubcategory MustardOil = new(8, nameof(MustardOil), ProductCategory.OilsAndGhee);
    public static readonly ProductSubcategory Ghee = new(9, nameof(Ghee), ProductCategory.OilsAndGhee);
    public static readonly ProductSubcategory OtherOils = new(10, nameof(OtherOils), ProductCategory.OilsAndGhee);

    public static readonly ProductSubcategory GroundSpices = new(11, nameof(GroundSpices), ProductCategory.Spices);
    public static readonly ProductSubcategory WholeSpices = new(12, nameof(WholeSpices), ProductCategory.Spices);
    public static readonly ProductSubcategory SpiceBlends = new(13, nameof(SpiceBlends), ProductCategory.Spices);

    public static readonly ProductSubcategory Lentils = new(14, nameof(Lentils), ProductCategory.Pulses);
    public static readonly ProductSubcategory ChickpeasAndPeas = new(15, nameof(ChickpeasAndPeas), ProductCategory.Pulses);

    public static readonly ProductSubcategory Tea = new(16, nameof(Tea), ProductCategory.TeaAndDrinks);
    public static readonly ProductSubcategory HerbalTea = new(17, nameof(HerbalTea), ProductCategory.TeaAndDrinks);
    public static readonly ProductSubcategory JuicesAndSyrups = new(18, nameof(JuicesAndSyrups), ProductCategory.TeaAndDrinks);

    public static readonly ProductSubcategory Fruit = new(19, nameof(Fruit), ProductCategory.FreshProduce);
    public static readonly ProductSubcategory Vegetables = new(20, nameof(Vegetables), ProductCategory.FreshProduce);

    public static readonly ProductSubcategory Dates = new(21, nameof(Dates), ProductCategory.DatesAndDryFruit);
    public static readonly ProductSubcategory Nuts = new(22, nameof(Nuts), ProductCategory.DatesAndDryFruit);
    public static readonly ProductSubcategory DriedFruit = new(23, nameof(DriedFruit), ProductCategory.DatesAndDryFruit);

    public static readonly ProductSubcategory Eggs = new(24, nameof(Eggs), ProductCategory.DairyAndEggs);
    public static readonly ProductSubcategory MilkAndYoghurt = new(25, nameof(MilkAndYoghurt), ProductCategory.DairyAndEggs);

    public static readonly ProductSubcategory Snacks = new(26, nameof(Snacks), ProductCategory.SnacksAndSweets);
    public static readonly ProductSubcategory TraditionalSweets = new(27, nameof(TraditionalSweets), ProductCategory.SnacksAndSweets);
    public static readonly ProductSubcategory Pickles = new(28, nameof(Pickles), ProductCategory.SnacksAndSweets);

    public static readonly ProductSubcategory JuteAndBags = new(29, nameof(JuteAndBags), ProductCategory.HouseholdAndCare);
    public static readonly ProductSubcategory NaturalCare = new(30, nameof(NaturalCare), ProductCategory.HouseholdAndCare);
}
