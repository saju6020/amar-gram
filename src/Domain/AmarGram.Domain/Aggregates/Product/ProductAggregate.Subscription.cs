namespace AmarGram.Domain.Aggregates.Product;

/// <summary>
/// HO-SUB-001 (BG-15, HO-P4 §11.4.5) -- the staff-editable "Can be subscribed to" flag. A partial of its own so the Subscriptions slice adds one property and
/// one method to the Product root without touching the file other areas edit. A SKU of the product can be subscribed to only while this is set and the SKU is
/// purchasable. Clearing it only stops NEW subscriptions being started (owner decision 2026-11-09): existing subscriptions are never paused, suspended, skipped or failed
/// because of it and keep getting their deliveries. A cycle fails <c>ProductUnavailable</c> and suspends only when the product is genuinely unpurchasable (unpublished,
/// archived, inactive SKU, no stock to sell), which is a separate rule (HO-SUB-001 §8.6).
/// </summary>
public sealed partial class ProductAggregate
{
    /// <summary>Whether customers may start a subscription to this product's SKUs. Off by default.</summary>
    public bool IsSubscribable { get; private set; }

    /// <summary>Idempotent: returns whether the flag changed (and the version moved).</summary>
    public bool SetSubscribable(bool value)
    {
        if (IsSubscribable == value) return false;

        IsSubscribable = value;
        UpdateVersion();
        return true;
    }
}
