namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-SUB-001 §8.12 (C-SHP-1, adapted) -- what Subscriptions needs to know about a SKU: its names, whether it can be bought at all right now
/// (<see cref="IsPurchasable"/>: an active, listed product with an active, priced SKU), whether staff offer it as a subscription
/// (<see cref="IsSubscribable"/>, BG-15) and its current price. Names and prices belong to Shop; this slice only reads them.
/// </summary>
public sealed record SubscribableSkuFacts(
    Guid SkuId, Guid ProductId, string ProductName, string VariantLabel, bool IsPurchasable, bool IsSubscribable, decimal? UnitPrice, string? CurrencyCode);

/// <summary>
/// HO-SUB-001 §8.12 -- the Shop port. Implemented in Infrastructure over Ordering's <see cref="ICatalogueLookup"/> (the one place that knows Shop's schema) plus
/// the product's <c>IsSubscribable</c> flag. Read-only.
/// </summary>
public interface ISubscribableCatalogue
{
    Task<IReadOnlyDictionary<Guid, SubscribableSkuFacts>> GetAsync(IReadOnlyCollection<Guid> skuIds, DateTimeOffset asOf, CancellationToken ct);
}
