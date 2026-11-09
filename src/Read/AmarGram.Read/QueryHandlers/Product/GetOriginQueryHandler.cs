using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Product;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>HO-SHP-001 section 12.4 -- 404 when the origin has no Active, listed food product.
/// The origin record is read as a column projection.</summary>
public sealed class GetOriginQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetOriginQuery, OriginViewModel?>
{
    public async Task<QueryResponse<OriginViewModel?>> HandleAsync(GetOriginQuery query)
    {
        if (!CountryCodes.IsValid(query.CountryCode)) return new QueryResponse<OriginViewModel?> { Result = null };

        var code = CountryCodes.Normalise(query.CountryCode);
        var counts = await GetOriginsQueryHandler.FoodOriginCountsAsync(db);
        var match = counts.FirstOrDefault(c => c.Code == code);
        if (match.Code is null) return new QueryResponse<OriginViewModel?> { Result = null };

        var record = await db.SourcingOrigins.AsNoTracking()
            .Where(o => o.CountryCode == code)
            .Select(o => new { o.SourcingNotes, o.IsFeatured })
            .FirstOrDefaultAsync();
        var result = new OriginViewModel(code, CountryCodes.FindName(code) ?? code, record?.SourcingNotes, match.Count, record?.IsFeatured ?? false);

        return new QueryResponse<OriginViewModel?> { Result = result };
    }
}
