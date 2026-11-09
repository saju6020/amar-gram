using AmarGram.Domain.DomainServices;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Infrastructure.Product;
using AmarGram.Read.Queries.Product;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>HO-SHP-001 section 12.4. Projected price rows (no aggregate); current is the greatest
/// EffectiveFrom not after now, the same rule as <c>SkuPricing</c>.</summary>
public sealed class GetSkuPriceHistoryQueryHandler(AmarGramDbContext db, TimeProvider timeProvider)
    : IQueryHandlerAsync<GetSkuPriceHistoryQuery, SkuPriceHistoryViewModel?>
{
    public async Task<QueryResponse<SkuPriceHistoryViewModel?>> HandleAsync(GetSkuPriceHistoryQuery query)
    {
        var skuExists = await db.SkuRows().AnyAsync(r => r.SkuId == query.SkuId);
        if (!skuExists) return new QueryResponse<SkuPriceHistoryViewModel?> { Result = null };

        var now = timeProvider.GetUtcNow();
        var prices = await db.PriceRows()
            .Where(p => p.SkuId == query.SkuId)
            .OrderByDescending(p => p.EffectiveFrom)
            .ToListAsync();

        var current = SkuPricing.PriceAt(prices, p => p.EffectiveFrom, now);
        var scheduled = prices.Where(p => p.EffectiveFrom > now).OrderBy(p => p.EffectiveFrom).Select(ToEntry).ToList();
        var past = prices.Where(p => p.EffectiveFrom <= now && p.Id != current?.Id)
            .OrderByDescending(p => p.EffectiveFrom).Select(ToEntry).ToList();

        var result = new SkuPriceHistoryViewModel(current is null ? null : ToEntry(current), scheduled, past);
        return new QueryResponse<SkuPriceHistoryViewModel?> { Result = result };
    }

    private static SkuPriceHistoryEntryViewModel ToEntry(PriceRow price) =>
        new(price.Id, new Money(price.Amount, price.CurrencyCode).ToViewModel(), price.EffectiveFrom, price.SetBy,
            price.CompareAtAmount is { } compareAt ? new Money(compareAt, price.CurrencyCode).ToViewModel() : null);
}
