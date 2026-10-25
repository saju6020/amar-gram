using AmarGram.Domain.DomainServices;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Infrastructure.Product;
using AmarGram.Read.Queries.Product;
using AmarGram.Read.QueryHandlers.StoredFile;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>HO-SHP-001 section 12.4/12.6 -- UI-4. Filtering, sorting and paging happen entirely in
/// SQL.</summary>
public sealed class GetStaffProductsQueryHandler(AmarGramDbContext db, TimeProvider timeProvider, IStoredFileSigningBatcher fileSigner)
    : IQueryHandlerAsync<GetStaffProductsQuery, PagedResult<StaffProductSummaryViewModel>>
{
    public async Task<QueryResponse<PagedResult<StaffProductSummaryViewModel>>> HandleAsync(GetStaffProductsQuery query)
    {
        var filtered = db.Products.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLowerInvariant();
            filtered = filtered.Where(p => p.SearchText.Contains(term) || p.Name.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) && EnumerationParsing.TryParse<AmarGram.Shared.Common.Enums.ProductStatus>(query.Status, out var status))
            filtered = filtered.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(query.Category) && EnumerationParsing.TryParse<ProductCategory>(query.Category, out var category))
            filtered = filtered.Where(p => p.Category == category);

        if (!string.IsNullOrWhiteSpace(query.Brand))
            filtered = filtered.Where(p => p.Brand == query.Brand);

        if (!string.IsNullOrWhiteSpace(query.Kind) && EnumerationParsing.TryParse<ProductKind>(query.Kind, out var kind))
            filtered = filtered.Where(p => p.Kind == kind);

        if (query.Listed is { } listed)
            filtered = filtered.Where(p => p.ListedOnStorefront == listed);

        if (!string.IsNullOrWhiteSpace(query.Barcode))
            filtered = filtered.Where(p => p.Skus.Any(s => s.Barcode == query.Barcode));

        var totalCount = await filtered.CountAsync();

        filtered = query.Sort switch
        {
            "name_desc" => filtered.OrderByDescending(p => p.Name),
            _ => filtered.OrderBy(p => p.Name)
        };

        // Two-phase (matches GetCustomerProfileQueryHandler): LastUpdatedDate is a platform DateTime
        // column; the DateTimeOffset conversion happens client-side after the DB-translatable phase.
        var rows = await filtered
            .Skip(query.Skip).Take(query.Take)
            .Select(p => new
            {
                p.Id, p.Name, p.Brand, Category = p.Category.DisplayName, Status = p.Status.DisplayName,
                Kind = p.Kind.DisplayName, KindValue = p.Kind, SkuCount = p.Skus.Count, p.ListedOnStorefront, p.LastUpdatedDate,
                p.CountryOfOriginCode, p.Certifications
            })
            .ToListAsync();

        // HO-P4 BG-9: the page's extras are read for the page's products only -- a fixed handful of queries however many rows.
        var extras = query.IncludeExtras
            ? await LoadExtrasAsync(rows.Select(r => r.Id).ToList(), rows.Where(r => r.KindValue == ProductKind.Bundle).Select(r => r.Id).ToHashSet(), query.BranchId)
            : [];

        var items = rows.Select(r =>
        {
            var extra = extras.GetValueOrDefault(r.Id);
            var country = r.CountryOfOriginCode is null ? null
                : new CountryRef(r.CountryOfOriginCode, CountryCodes.FindName(r.CountryOfOriginCode) ?? r.CountryOfOriginCode);
            return new StaffProductSummaryViewModel(
                r.Id, r.Name, r.Brand, r.Category, r.Status, r.Kind, r.SkuCount, r.ListedOnStorefront,
                new DateTimeOffset(DateTime.SpecifyKind(r.LastUpdatedDate, DateTimeKind.Utc)),
                country, extra?.PackSizes ?? [], extra?.PriceRange, extra?.AvailableStock, extra?.PrimaryImage,
                r.Certifications.Contains(Certification.CertifiedOrganic));
        }).ToList();

        return new QueryResponse<PagedResult<StaffProductSummaryViewModel>>
        {
            Result = new PagedResult<StaffProductSummaryViewModel>(items, query.PageNumber, query.PageSize, totalCount)
        };
    }

    private sealed record PageExtras(IReadOnlyList<string> PackSizes, StaffPriceRangeViewModel? PriceRange, decimal? AvailableStock, ProductImageRef? PrimaryImage);

    /// <summary>Pack sizes, price range, stock and the primary thumbnail of the page's products. Active SKUs only; prices are the ones in
    /// force now (<see cref="SkuPricing"/>); stock is <c>inventory.v_sku_sellable</c> at the caller's active branch (a bundle has none).</summary>
    private async Task<Dictionary<Guid, PageExtras>> LoadExtrasAsync(IReadOnlyList<Guid> productIds, IReadOnlySet<Guid> bundleIds, Guid? branchId)
    {
        if (productIds.Count == 0) return [];

        var now = timeProvider.GetUtcNow();
        var skus = await db.SkuRows().Where(s => productIds.Contains(s.ProductId) && s.SkuStatus == SkuStatus.Active).ToListAsync();
        var skuIds = skus.Select(s => s.SkuId).ToList();
        var prices = (await db.PriceRows().Where(p => skuIds.Contains(p.SkuId) && p.EffectiveFrom <= now).ToListAsync()).ToLookup(p => p.SkuId);
        var stock = branchId is { } branch
            ? await SkuSellability.StockAsync(db, skus.Where(s => !bundleIds.Contains(s.ProductId)).Select(s => s.SkuId).ToList(), branch)
            : [];

        var images = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .SelectMany(p => p.Images.Where(i => i.SkuId == null), (p, i) => new { ProductId = p.Id, i.FileId, i.AltText, i.IsPrimary, i.SortOrder })
            .ToListAsync();
        var chosenImages = images.GroupBy(i => i.ProductId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).First());
        var urls = await ProductImageUrls.SignAsync(fileSigner, chosenImages.Values.Select(i => i.FileId));

        var result = new Dictionary<Guid, PageExtras>();
        foreach (var productId in productIds)
        {
            var own = skus.Where(s => s.ProductId == productId)
                .Select(s => new { Sku = s, Price = SkuPricing.PriceAt(prices[s.SkuId], p => p.EffectiveFrom, now) })
                .ToList();

            var priced = own.Where(x => x.Price is not null).OrderBy(x => x.Price!.Amount).ThenBy(x => x.Sku.SkuCode).ToList();
            var sizes = own.OrderBy(x => x.Price?.Amount ?? decimal.MaxValue).ThenBy(x => x.Sku.SkuCode)
                .Select(x => CatalogueSizeExpansion.SizeLabelOf(x.Sku)).OfType<string>().ToList();

            StaffPriceRangeViewModel? range = null;
            if (priced.Count > 0)
            {
                var low = priced[0].Price!;
                var high = priced[^1].Price!;
                range = new StaffPriceRangeViewModel(new Money(low.Amount, low.CurrencyCode).ToViewModel(), new Money(high.Amount, high.CurrencyCode).ToViewModel());
            }

            decimal? available = null;
            var reported = own.Where(x => stock.ContainsKey(x.Sku.SkuId)).ToList();
            if (reported.Count > 0) available = reported.Sum(x => stock[x.Sku.SkuId].SellableQuantity);

            ProductImageRef? primary = null;
            if (chosenImages.TryGetValue(productId, out var image))
                primary = new ProductImageRef(urls.GetValueOrDefault(image.FileId), image.AltText, image.IsPrimary, null);

            result[productId] = new PageExtras(sizes, range, available, primary);
        }

        return result;
    }
}
