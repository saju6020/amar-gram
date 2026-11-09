namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-IMP-001 §10.1 -- The item class of a SKU (§8.2); Food requires an expiry (D-2); HO-P1 retired value 2. Persisted by <c>Value</c> (ADR-022).</summary>
public sealed class StockClass(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly StockClass Food = new(1, nameof(Food));
    public static readonly StockClass Consumable = new(3, nameof(Consumable));
    public static readonly StockClass General = new(4, nameof(General));
}
