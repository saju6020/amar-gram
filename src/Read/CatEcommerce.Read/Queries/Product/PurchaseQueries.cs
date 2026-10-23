using CatEcommerce.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace CatEcommerce.Read.Queries.Product;

/// <summary>HO-SHP-001 section 8.10 -- contract query; null for a non-bundle SKU.</summary>
public sealed class GetBundleCompositionQuery : Query<IReadOnlyList<BundleCompositionLineViewModel>?>
{
    public required Guid BundleSkuId { get; init; }
}

/// <summary>HO-SHP-001 section 12.4 -- public, with an optional customer.</summary>
public sealed class GetProductRecommendationsQuery : Query<RecommendationsViewModel?>
{
    public required string Slug { get; init; }
    public Guid? CustomerId { get; init; }
    public string? Locale { get; init; }
}

/// <summary>HO-SHP-001 section 8.12 -- contract query consumed by HO-ORD-001 and POS.</summary>
public sealed class GetSkuSaleFactsQuery : Query<IReadOnlyList<SkuSaleFactViewModel>>
{
    public required IReadOnlyList<Guid> SkuIds { get; init; }
    public required DateTimeOffset AsOf { get; init; }
}

/// <summary>HO-SHP-001 section 8.12 -- contract query consumed by HO-IMP-001 and HO-RPT-001.</summary>
public sealed class GetSkuCatalogueFactsQuery : Query<IReadOnlyList<SkuCatalogueFactViewModel>>
{
    public required IReadOnlyList<Guid> SkuIds { get; init; }
}
