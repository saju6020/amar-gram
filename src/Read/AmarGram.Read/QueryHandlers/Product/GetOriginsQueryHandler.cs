using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Product;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>HO-SHP-001 section 8.6/12.4/12.6 -- US-SHP-05 AC1. An origin appears only when at least
/// one Active, listed FOOD product has that country of origin; a record with no such product is not
/// listed; a country with products but no record is still listed, with no notes. Origin records are
/// read as column projections.</summary>
public sealed class GetOriginsQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetOriginsQuery, IReadOnlyList<OriginViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<OriginViewModel>>> HandleAsync(GetOriginsQuery query)
    {
        var counts = await FoodOriginCountsAsync(db);
        var records = await db.SourcingOrigins.AsNoTracking()
            .Select(r => new { r.CountryCode, r.SourcingNotes, r.IsFeatured, r.SortOrder })
            .ToListAsync();

        var items = counts.Select(c =>
        {
            var record = records.FirstOrDefault(r => r.CountryCode == c.Code);
            return new OriginViewModel(c.Code, CountryCodes.FindName(c.Code) ?? c.Code, record?.SourcingNotes, c.Count, record?.IsFeatured ?? false);
        })
        .OrderByDescending(o => o.IsFeatured)
        .ThenBy(o => records.FirstOrDefault(r => r.CountryCode == o.Code)?.SortOrder ?? int.MaxValue)
        .ThenBy(o => o.Name)
        .ToList();

        return new QueryResponse<IReadOnlyList<OriginViewModel>> { Result = items };
    }

    internal static async Task<List<(string Code, int Count)>> FoodOriginCountsAsync(AmarGramDbContext db)
    {
        // HO-P2 §1.1: every food category, not one value.
        var foodCategories = ProductCategory.FoodValues;
        var rows = await db.StorefrontCatalogueEntries.AsNoTracking()
            .Where(e => e.CountryOfOriginCode != null && foodCategories.Contains(e.Category))
            .GroupBy(e => e.CountryOfOriginCode!)
            .Select(g => new { Code = g.Key, Count = g.Count() })
            .ToListAsync();

        return rows.Select(r => (r.Code, r.Count)).ToList();
    }
}
