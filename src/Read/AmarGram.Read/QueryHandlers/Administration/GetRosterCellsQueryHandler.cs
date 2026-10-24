using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Administration;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Administration;

/// <summary>HO-P4 BG-23. Loads the rosters and the active exceptions of the range and asks the pure domain functions for each day's effective
/// slots (<see cref="StaffAvailability.EffectiveSlots"/>) and its name (<see cref="RosterShiftCells.Classify"/>) -- the calendar rules are never
/// re-implemented here. Leave and opening hours are deliberately not applied: the grid shows what was rostered.</summary>
public sealed class GetRosterCellsQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetRosterCellsQuery, IReadOnlyList<RosterCellViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<RosterCellViewModel>>> HandleAsync(GetRosterCellsQuery query)
    {
        var rosters = await db.Set<StaffRosterAggregate>().AsNoTracking().Where(r => r.BranchId == query.BranchId &&
            (query.StaffAccountId == null || r.StaffAccountId == query.StaffAccountId)).ToListAsync();

        var exceptions = await db.Set<RosterExceptionAggregate>().AsNoTracking()
            .Where(e => e.BranchId == query.BranchId && !e.IsCancelled && e.Date >= query.From && e.Date <= query.To &&
                (query.StaffAccountId == null || e.StaffAccountId == query.StaffAccountId))
            .ToListAsync();

        var result = new List<RosterCellViewModel>();
        foreach (var roster in rosters.OrderBy(r => r.StaffAccountId))
        {
            var own = exceptions.Where(e => e.StaffAccountId == roster.StaffAccountId).ToList();
            for (var date = query.From; date <= query.To; date = date.AddDays(1))
            {
                var slots = StaffAvailability.EffectiveSlots(roster, own, date).Where(s => s.Starts < s.Ends).OrderBy(s => s.Starts).ToList();
                result.Add(new RosterCellViewModel(
                    roster.StaffAccountId, roster.BranchId, date, RosterShiftCells.Classify(slots).DisplayName,
                    slots.Select(s => new RosterCellSlotViewModel(s.Starts.ToString("HH:mm"), s.Ends.ToString("HH:mm"))).ToList()));
            }
        }

        return new QueryResponse<IReadOnlyList<RosterCellViewModel>> { Result = result };
    }
}
