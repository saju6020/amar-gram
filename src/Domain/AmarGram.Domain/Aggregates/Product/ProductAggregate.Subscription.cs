namespace AmarGram.Domain.Aggregates.Product;

/// <summary>
/// HO-SUB-001 (BG-15, HO-P4 §11.4.5) -- the staff-editable "Can be subscribed to" flag. A partial of its own so the Subscriptions slice adds one property and
/// one method to the Product root without touching the file other areas edit. A SKU of the product can be subscribed to only while this is set and the SKU is
/// purchasable; clearing it never touches existing subscriptions -- their next cycle simply fails <c>ProductUnavailable</c> and suspends (HO-SUB-001 §8.6).
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
