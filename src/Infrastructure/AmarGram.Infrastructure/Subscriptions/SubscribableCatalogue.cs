using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Subscriptions;

/// <summary>
/// HO-SUB-001 §8.12 (C-SHP-1, adapted) -- <see cref="ISubscribableCatalogue"/> over Ordering's <see cref="ICatalogueLookup"/> (names, price, the storefront's own
/// "purchasable" rule) and the product's <c>IsSubscribable</c> flag. Projections only (<c>AsNoTracking</c>); nothing is materialised as an aggregate.
/// </summary>
public sealed class SubscribableCatalogue(AmarGramDbContext db, ICatalogueLookup catalogue) : ISubscribableCatalogue
{
    public async Task<IReadOnlyDictionary<Guid, SubscribableSkuFacts>> GetAsync(IReadOnlyCollection<Guid> skuIds, DateTimeOffset asOf, CancellationToken ct)
    {
        var skus = await catalogue.GetSkusAsync(skuIds, asOf, ct);
        if (skus.Count == 0) return new Dictionary<Guid, SubscribableSkuFacts>();

        var productIds = skus.Values.Select(s => s.ProductId).Distinct().ToList();
        var flags = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).Select(p => new { p.Id, p.IsSubscribable }).ToListAsync(ct);
        var subscribable = flags.Where(f => f.IsSubscribable).Select(f => f.Id).ToHashSet();

        return skus.ToDictionary(
            kv => kv.Key,
            kv => new SubscribableSkuFacts(
                kv.Key, kv.Value.ProductId, kv.Value.ProductName, kv.Value.VariantLabel, kv.Value.IsPurchasable,
                subscribable.Contains(kv.Value.ProductId), kv.Value.CurrentPrice, kv.Value.CurrencyCode));
    }
}
