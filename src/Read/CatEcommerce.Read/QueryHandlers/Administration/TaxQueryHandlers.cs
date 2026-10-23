using CatEcommerce.Domain.Aggregates.Administration;
using CatEcommerce.Infrastructure.Persistence;
using CatEcommerce.Read.Queries.Administration;
using CatEcommerce.Read.ViewModels;
using CatEcommerce.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace CatEcommerce.Read.QueryHandlers.Administration;

public sealed class GetTaxClassesQueryHandler(CatEcommerceDbContext db) : IQueryHandlerAsync<GetTaxClassesQuery, IReadOnlyList<TaxClassViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<TaxClassViewModel>>> HandleAsync(GetTaxClassesQuery query)
    {
        var result = await db.Set<TaxClassAggregate>().AsNoTracking().OrderBy(t => t.Name)
            .Select(t => new TaxClassViewModel(t.Id, t.Code, t.Name, t.IsActive))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<TaxClassViewModel>> { Result = result };
    }
}

public sealed class GetTaxRatesQueryHandler(CatEcommerceDbContext db) : IQueryHandlerAsync<GetTaxRatesQuery, IReadOnlyList<TaxRateViewModel>>
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
