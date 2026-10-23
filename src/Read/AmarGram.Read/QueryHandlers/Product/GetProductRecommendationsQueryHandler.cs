using AmarGram.Read.QueryHandlers.StoredFile;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Configuration;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Infrastructure.Persistence.Views;
using AmarGram.Infrastructure.Product;
using AmarGram.Read.Queries.Product;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>
/// HO-SHP-001 section 8.10 / 12.4 -- US-SHP-08. Curated "frequently bought together" and up-sell
/// links, each filtered to what is on sale and in stock, never the product itself. Column
/// projections only; availability is fail-closed unless the interim flag is on.
/// </summary>
public sealed class GetProductRecommendationsQueryHandler(
    AmarGramDbContext db, IContentLocaleSettings localeSettings,
    TimeProvider timeProvider, IOptions<ShopOptions> shopOptions, IStoredFileSigningBatcher fileSigner)
    : IQueryHandlerAsync<GetProductRecommendationsQuery, RecommendationsViewModel?>
{
    public async Task<QueryResponse<RecommendationsViewModel?>> HandleAsync(GetProductRecommendationsQuery query)
    {
        var branchId = shopOptions.Value.EffectiveStorefrontBranchId;

        var product = await db.Products.AsNoTracking()
            .Where(p => p.Slug == query.Slug && p.Status == ProductStatus.Active && p.ListedOnStorefront)
            .Select(p => new
            {
                p.Id,
                Links = p.RelatedProducts.Select(l => new { l.RelatedProductId, l.Kind, l.SortOrder }).ToList()
            })
            .FirstOrDefaultAsync();

        if (product is null) return new QueryResponse<RecommendationsViewModel?> { Result = null };

        var linkedIds = product.Links.Select(l => l.RelatedProductId).Distinct().ToList();
        var linkedEntries = linkedIds.Count == 0
            ? []
            : await db.StorefrontCatalogueEntries.AsNoTracking().Where(e => linkedIds.Contains(e.ProductId)).ToListAsync();

        var sellable = await StorefrontAvailability.SellableProductIdsAsync(db, linkedEntries.Select(e => e.ProductId).ToList(), timeProvider.GetUtcNow(), branchId);

        IReadOnlyList<CatalogueItem> CuratedBlock(RelatedProductKind kind) => product.Links
            .Where(l => l.Kind == kind).OrderBy(l => l.SortOrder)
            .Select(l => linkedEntries.FirstOrDefault(e => e.ProductId == l.RelatedProductId))
            .Where(e => e is not null && IsIncluded(e, product.Id, sellable))
            .Select(e => GetCatalogueQueryHandler.ToCatalogueItem(e!, sellable.Contains(e!.ProductId))).ToList();

        // US-SHP-14: names in the requested language, per-field fallback to the default.
        var result = new RecommendationsViewModel(
            await ProductImageUrls.WithPrimaryImageUrlsAsync(db, fileSigner, await CatalogueItemLocaliser.ApplyAsync(db, localeSettings, CuratedBlock(RelatedProductKind.FrequentlyBoughtTogether), query.Locale)),
            await ProductImageUrls.WithPrimaryImageUrlsAsync(db, fileSigner, await CatalogueItemLocaliser.ApplyAsync(db, localeSettings, CuratedBlock(RelatedProductKind.UpSell), query.Locale)));

        return new QueryResponse<RecommendationsViewModel?> { Result = result };
    }

    private static bool IsIncluded(StorefrontCatalogueEntry entry, Guid productId, HashSet<Guid> sellable) =>
        sellable.Contains(entry.ProductId) && entry.ProductId != productId;
}
