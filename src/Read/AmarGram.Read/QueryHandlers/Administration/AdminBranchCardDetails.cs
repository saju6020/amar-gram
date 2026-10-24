using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Read.QueryHandlers.Administration;

/// <summary>
/// HO-P4 BG-21 -- the outlet-card details the admin branch list and detail share: today's hours, delivery areas and active staff count for a
/// set of branches, each fetched in one query for the whole set (never one per branch, except the calendar, which is a domain service that
/// loads its own branch and closures). Today's hours go through <see cref="IBranchCalendar"/>, so weekly hours AND closures apply.
/// </summary>
internal sealed class AdminBranchCardDetails(AmarGramDbContext db, IBranchCalendar branchCalendar, TimeProvider timeProvider)
{
    public sealed record Details(BranchTodayHoursViewModel TodayHours, IReadOnlyList<string> DeliveryAreas, int ActiveStaffCount);

    public async Task<Dictionary<Guid, Details>> LoadAsync(IReadOnlyCollection<(Guid BranchId, string TimeZoneId)> branches)
    {
        var ids = branches.Select(b => b.BranchId).ToList();
        if (ids.Count == 0) return [];

        var zones = await db.Set<DeliveryZoneAggregate>().AsNoTracking()
            .Where(z => z.IsActive && ids.Contains(z.BranchId))
            .OrderBy(z => z.Priority).ThenBy(z => z.Name)
            .Select(z => new { z.BranchId, z.Name })
            .ToListAsync();
        var zonesByBranch = zones.GroupBy(z => z.BranchId).ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(z => z.Name).Distinct().ToList());

        // Staff accounts are never deactivated (no disabled state), so "active" is: the account exists and is assigned to the branch.
        var assignments = await db.Set<StaffBranchAssignmentAggregate>().AsNoTracking()
            .Where(a => db.Set<StaffAccountAggregate>().Any(s => s.Id == a.Id))
            .Select(a => a.BranchIds)
            .ToListAsync();
        var staffByBranch = assignments.SelectMany(b => b).GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());

        var now = timeProvider.GetUtcNow();
        var result = new Dictionary<Guid, Details>();
        foreach (var (branchId, timeZoneId) in branches)
        {
            result[branchId] = new Details(
                await TodayHoursAsync(branchId, timeZoneId, now),
                zonesByBranch.GetValueOrDefault(branchId) ?? [],
                staffByBranch.GetValueOrDefault(branchId));
        }

        return result;
    }

    private async Task<BranchTodayHoursViewModel> TodayHoursAsync(Guid branchId, string timeZoneId, DateTimeOffset now)
    {
        var today = BranchCalendar.LocalDateOf(now, timeZoneId);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var intervals = await branchCalendar.OpenIntervalsAsync(branchId, today, today, CancellationToken.None);

        var local = intervals
            .Select(i => (Opens: TimeOnly.FromDateTime(TimeZoneInfo.ConvertTime(i.Start, zone).DateTime), Closes: TimeOnly.FromDateTime(TimeZoneInfo.ConvertTime(i.End, zone).DateTime)))
            .OrderBy(i => i.Opens)
            .ToList();

        var day = today.DayOfWeek.ToString();
        var views = local.Select(i => new OpeningIntervalViewModel(day, i.Opens.ToString("HH:mm"), i.Closes.ToString("HH:mm"))).ToList();
        var summary = views.Count == 0 ? "Closed" : string.Join(", ", views.Select(v => $"{v.Opens}-{v.Closes}"));

        return new BranchTodayHoursViewModel(today, views.Count > 0, summary, views);
    }
}
