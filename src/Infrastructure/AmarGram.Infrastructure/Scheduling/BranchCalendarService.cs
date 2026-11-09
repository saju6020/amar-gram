using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Scheduling;

/// <summary>HO-ADM-001 §8.9/§12.2. Loads with <c>AsNoTracking</c>, calls the pure
/// <see cref="BranchCalendar"/>.</summary>
public sealed class BranchCalendarService(AmarGramDbContext db) : IBranchCalendar
{
    public async Task<IReadOnlyList<TimeInterval>> OpenIntervalsAsync(Guid branchId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var branch = await db.Set<BranchAggregate>().AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId, ct);
        if (branch is null) return [];

        var closures = await db.Set<BranchClosureAggregate>().AsNoTracking()
            .Where(c => c.BranchId == branchId && !c.IsCancelled && c.StartsOn <= to && c.EndsOn >= from)
            .ToListAsync(ct);

        return BranchCalendar.OpenIntervals(branch, closures, from, to);
    }
}
