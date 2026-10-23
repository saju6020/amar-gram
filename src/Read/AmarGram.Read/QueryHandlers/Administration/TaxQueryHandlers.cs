using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Administration;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Administration;

public sealed class GetTaxClassesQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetTaxClassesQuery, IReadOnlyList<TaxClassViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<TaxClassViewModel>>> HandleAsync(GetTaxClassesQuery query)
    {
        var result = await db.Set<TaxClassAggregate>().AsNoTracking().OrderBy(t => t.Name)
            .Select(t => new TaxClassViewModel(t.Id, t.Code, t.Name, t.IsActive))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<TaxClassViewModel>> { Result = result };
    }
}

public sealed class GetTaxRatesQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetTaxRatesQuery, IReadOnlyList<TaxRateViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<TaxRateViewModel>>> HandleAsync(GetTaxRatesQuery query)
    {
        var result = await db.Set<TaxRateAggregate>().AsNoTracking()
            .Where(r => r.TaxClassId == query.TaxClassId)
            .OrderByDescending(r => r.EffectiveFrom)
            .Take(AdministrationListCaps.MaxUnboundedListSize)
            .Select(r => new TaxRateViewModel(r.Id, r.TaxClassId, r.RatePercent, r.EffectiveFrom))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<TaxRateViewModel>> { Result = result };
    }
}
