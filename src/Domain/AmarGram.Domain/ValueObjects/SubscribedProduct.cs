namespace AmarGram.Domain.ValueObjects;

/// <summary>
/// HO-SUB-001 §8.2 -- the display snapshot of the subscribed SKU, taken at creation. Reads prefer the catalogue's current names; this is the fallback when
/// the product has since been renamed or archived. Adapted: the original's <c>IsPrescriptionDiet</c> is retired with the clinic (HO-P1).
/// </summary>
public sealed record SubscribedProduct
{
    public string ProductName { get; private init; } = default!;
    public string VariantLabel { get; private init; } = default!;

    private SubscribedProduct() { }

    public SubscribedProduct(string productName, string variantLabel)
    {
        ProductName = Truncate(productName, 200);
        VariantLabel = Truncate(variantLabel, 200);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
