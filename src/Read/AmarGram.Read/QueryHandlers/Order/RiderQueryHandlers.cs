using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Order;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Order;

/// <summary>HO-P4 BG-5 -- the branch's riders, by name. A rider of another branch never appears.</summary>
public sealed class GetRidersQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetRidersQuery, IReadOnlyList<RiderViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<RiderViewModel>>> HandleAsync(GetRidersQuery query)
    {
        IReadOnlyList<RiderViewModel> riders = await db.Riders.AsNoTracking()
            .Where(r => r.BranchId == query.BranchId && (!query.ActiveOnly || r.IsActive))
            .OrderBy(r => r.Name)
            .Take(AdministrationListCaps.MaxUnboundedListSize)
            .Select(r => new RiderViewModel(r.Id, r.Name, r.MobileNumber, r.IsActive))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<RiderViewModel>> { Result = riders };
    }
}
