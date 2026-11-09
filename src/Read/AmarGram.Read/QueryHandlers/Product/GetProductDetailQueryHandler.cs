using AmarGram.Read.QueryHandlers.StoredFile;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Entities;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Infrastructure.Product;
using AmarGram.Read.Queries.Product;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>
/// HO-SHP-001 section 12.4/12.6 -- 404 for draft, archived, unlisted or unknown. Column projections
/// only (.ai/read-side-pattern.md section 4): the product row with its image, translation and food
/// columns in one split query, the SKU rows, the price rows and (for a bundle) the component rows --
/// a fixed handful of queries however many SKUs or components there are. Per-SKU availability is
/// <see cref="ISkuAvailabilityReader"/> over <c>inventory.v_sku_sellable</c> (a SKU Inventory never stocked
/// is out of stock); the expiry notice (US-SHP-07 AC2) is the view's FEFO-first expiry of an in-stock SKU
/// when it falls inside <c>shop.expiryDisplayWindowDays</c> of today (<see cref="SkuAvailabilityRules.ExpiryNotice"/>).
/// </summary>
public sealed class GetProductDetailQueryHandler(
    AmarGramDbContext db, TimeProvider timeProvider, IBusinessSettings businessSettings, IContentLocaleSettings localeSettings,
    ISkuAvailabilityReader availabilityReader, Microsoft.Extensions.Options.IOptions<AmarGram.Infrastructure.Configuration.ShopOptions> shopOptions,
    IStoredFileSigningBatcher fileSigner)
    : IQueryHandlerAsync<GetProductDetailQuery, ProductDetailViewModel?>
{
    public async Task<QueryResponse<ProductDetailViewModel?>> HandleAsync(GetProductDetailQuery query)
    {
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Slug == query.Slug && p.Status == ProductStatus.Active && p.ListedOnStorefront)
            .Select(p => new
            {
                p.Id, p.Slug, p.Name, p.Brand, p.Description, p.Category, p.Subcategory, p.Tags, p.Kind, p.CountryOfOriginCode, p.DistrictOfOrigin,
                p.Certifications,
                IngredientList = p.FoodDetails == null ? null : p.FoodDetails.IngredientList,
                StorageInstructions = p.FoodDetails == null ? null : p.FoodDetails.StorageInstructions,
                ShelfLife = p.FoodDetails == null ? null : p.FoodDetails.ShelfLife,
                NetWeight = p.FoodDetails == null ? null : p.FoodDetails.NetWeight,
                Allergens = p.FoodDetails == null ? null : p.FoodDetails.Allergens,
                OrganicCertifier = p.FoodDetails == null ? null : p.FoodDetails.OrganicCertifier,
                OrganicCertificateNumber = p.FoodDetails == null ? null : p.FoodDetails.OrganicCertificateNumber,
                Images = p.Images.Select(i => new { i.SkuId, i.FileId, i.AltText, i.IsPrimary, i.SortOrder }).ToList(),
                Translations = p.Translations.Select(t => new { t.Locale, t.Name, t.Description, t.IngredientList }).ToList()
            })
            .AsSplitQuery()
            .FirstOrDefaultAsync();

        if (product is null) return new QueryResponse<ProductDetailViewModel?> { Result = null };

        var now = timeProvider.GetUtcNow();
        var imageUrls = await ProductImageUrls.SignAsync(fileSigner, product.Images.Select(i => i.FileId), FileVariants.Detail);
        var skus = await db.SkuRows().Where(s => s.ProductId == product.Id && s.SkuStatus == SkuStatus.Active).ToListAsync();
        var skuIds = skus.Select(s => s.SkuId).ToList();
        var prices = await db.PriceRows().Where(p => skuIds.Contains(p.SkuId) && p.EffectiveFrom <= now).ToListAsync();
        var rating = await db.ProductRatingSummaries.AsNoTracking().Where(r => r.ProductId == product.Id)
            .Select(r => new { r.RatingAverage, r.RatingCount }).FirstOrDefaultAsync();

        var availabilityBySku = await availabilityReader.GetAsync(skuIds);
        var expiryNoticeBySku = await ExpiryNoticesAsync(product.Kind, skus.Select(s => s.SkuId).ToList(), availabilityBySku);

        var skuViewModels = skus.Select(s =>
        {
            var current = SkuPricing.PriceAt(prices.Where(p => p.SkuId == s.SkuId), p => p.EffectiveFrom, now);
            var availability = availabilityBySku.GetValueOrDefault(s.SkuId, AvailabilityStatus.OutOfStock);
            var images = product.Images.Where(i => i.SkuId == s.SkuId)
                .Select(i => new ProductImageRef(imageUrls.GetValueOrDefault(i.FileId), i.AltText, i.IsPrimary, s.SkuId)).ToList();

            return new DetailSkuViewModel(
                s.SkuId, s.SkuCode, s.Label, s.SizeOrWeight, s.Flavour, s.Colour, s.PackQuantity,
                current is null ? null : new Money(current.Amount, current.CurrencyCode).ToViewModel(), availability.DisplayName,
                expiryNoticeBySku.GetValueOrDefault(s.SkuId), images,
                current?.CompareAtAmount is { } compareAt ? new Money(compareAt, current.CurrencyCode).ToViewModel() : null);
        }).ToList();

        // US-SHP-14: per-field fallback to the default language; an unknown or disabled locale is the
        // default, never an error on a public read.
        var translations = product.Translations
            .Select(t => new ProductTranslation(t.Locale, t.Name, t.Description, t.IngredientList)).ToList();
        var localised = ProductContentLocalisation.Resolve(
            product.Name, product.Description, product.IngredientList,
            translations, query.Locale, localeSettings.DefaultLocale, localeSettings.EnabledLocales);

        FoodDetailViewModel? food = null;
        var hasFoodDetails = product.IngredientList is not null || product.StorageInstructions is not null
            || product.ShelfLife is not null || product.NetWeight is not null || product.Allergens is not null
            || product.OrganicCertifier is not null || product.OrganicCertificateNumber is not null;
        if (product.Category.IsFood && hasFoodDetails)
        {
            food = new FoodDetailViewModel(localised.IngredientList, product.StorageInstructions, product.ShelfLife,
                product.NetWeight, product.Allergens, product.OrganicCertifier, product.OrganicCertificateNumber);
        }

        var productImages = product.Images.Where(i => i.SkuId is null)
            .OrderBy(i => i.SortOrder)
            .Select(i => new ProductImageRef(imageUrls.GetValueOrDefault(i.FileId), i.AltText, i.IsPrimary, null)).ToList();

        var country = product.CountryOfOriginCode is null ? null
            : new CountryRef(product.CountryOfOriginCode, AmarGram.Shared.Common.Constants.CountryCodes.FindName(product.CountryOfOriginCode) ?? product.CountryOfOriginCode);

        var result = new ProductDetailViewModel(
            product.Id, product.Slug, localised.Name, product.Brand, localised.Description, product.Category.DisplayName,
            product.Subcategory?.DisplayName, product.Tags, product.Certifications.Select(c => c.DisplayName).ToList(), product.Kind.DisplayName, country,
            food, productImages, skuViewModels, new RatingSummary(rating?.RatingAverage, rating?.RatingCount ?? 0),
            businessSettings.GetBool(AmarGram.Shared.Common.Constants.SettingKeys.CommercePricesIncludeTax), localised.Locale, localised.FieldLocales,
            await BuildBundleAsync(product.Id, product.Kind),
            product.DistrictOfOrigin);

        return new QueryResponse<ProductDetailViewModel?> { Result = result };
    }

    /// <summary>US-SHP-07 AC2 -- the short-dated notice per in-stock SKU: the view's FEFO-first expiry when it is inside the
    /// configured window of today (the storefront branch's business date). A bundle's own SKU holds no stock, so it has none.</summary>
    private async Task<Dictionary<Guid, ExpiryNoticeViewModel>> ExpiryNoticesAsync(
        ProductKind kind, IReadOnlyCollection<Guid> skuIds, IReadOnlyDictionary<Guid, AvailabilityStatus> availability)
    {
        var notices = new Dictionary<Guid, ExpiryNoticeViewModel>();
        var window = businessSettings.GetInt(AmarGram.Shared.Common.Constants.SettingKeys.ShopExpiryDisplayWindowDays);
        if (kind == ProductKind.Bundle || window <= 0) return notices;

        var inStockIds = skuIds.Where(id => availability.GetValueOrDefault(id) == AvailabilityStatus.InStock).ToList();
        var stock = await SkuSellability.StockAsync(db, inStockIds, shopOptions.Value.EffectiveStorefrontBranchId);
        var today = await ShopBusinessDate.TodayAsync(db, timeProvider, shopOptions.Value.EffectiveStorefrontBranchId);

        foreach (var (skuId, figure) in stock)
        {
            if (SkuAvailabilityRules.ExpiryNotice(figure.NextExpiresOn, today, window) is { } expiresOn)
                notices[skuId] = new ExpiryNoticeViewModel(expiresOn);
        }

        return notices;
    }

    /// <summary>HO-SHP-001 section 12.4 -- a bundle's components, each with its own availability
    /// (US-SHP-12 AC2: any component out of stock makes the bundle unavailable). Component rows and
    /// the component SKU rows are two projected reads, however many components there are.</summary>
    private async Task<BundleDetailViewModel?> BuildBundleAsync(Guid productId, ProductKind kind)
    {
        if (kind != ProductKind.Bundle) return null;

        var components = await db.BundleComponentRows().Where(c => c.ProductId == productId).ToListAsync();
        var componentSkuIds = components.Select(c => c.ComponentSkuId).ToList();
        var rows = componentSkuIds.Count == 0
            ? []
            : await db.SkuRows().Where(r => componentSkuIds.Contains(r.SkuId)).ToListAsync();
        var availability = await availabilityReader.GetAsync(componentSkuIds);

        var details = new List<BundleComponentDetailViewModel>();
        foreach (var component in components)
        {
            var row = rows.FirstOrDefault(r => r.SkuId == component.ComponentSkuId);
            if (row is null) continue;

            details.Add(new BundleComponentDetailViewModel(
                row.ProductName, row.ProductSlug, row.Label, component.Quantity,
                availability.GetValueOrDefault(component.ComponentSkuId, AvailabilityStatus.OutOfStock).DisplayName));
        }

        return new BundleDetailViewModel(details);
    }
}
