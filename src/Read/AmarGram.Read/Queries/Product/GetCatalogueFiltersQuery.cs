using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Product;

public sealed record NamedCount(string Value, int Count);

/// <summary>HO-SHP-001 section 12.4; HO-P2 §1.4 -- `brands[{ name, count }]` (the producers) (the other facets are `{ value, count }`).</summary>
public sealed record BrandCount(string Name, int Count);
public sealed record OriginCount(string Code, string Name, int Count);
public sealed record PriceBounds(decimal? Min, decimal? Max);

public sealed record CatalogueFiltersViewModel(
    IReadOnlyList<BrandCount> Brands,
    IReadOnlyList<OriginCount> Origins,
    IReadOnlyList<NamedCount> Certifications,
    PriceBounds Price,
    // HO-P3 G1: `districts[{ value, count }]` -- the districts of origin present, by name.
    IReadOnlyList<NamedCount> Districts);

/// <summary>HO-SHP-001 section 8.8/12.4 -- facets over active, listed products, optionally within
/// a category.</summary>
public sealed class GetCatalogueFiltersQuery : Query<CatalogueFiltersViewModel>
{
    public string? Category { get; init; }
}
