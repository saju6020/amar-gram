using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-ADM-001 §8.5 / ADR-047. Pure function over pre-loaded roster, exceptions, approved leave and
/// the branch's open intervals (from <see cref="BranchCalendar"/>) -- no I/O, so this can be
/// tested without a database. <paramref
/// name="timeZoneId"/> is the branch's own -- the inferred parameter this pure function needs to
/// convert a shift's local <c>TimeOnly</c> into an instant (§20.7); not named as such in the prose
/// signature but required by rule 1.
/// </summary>
public static class StaffAvailability
{
    public static IReadOnlyList<StaffAvailableInterval> Intervals(
        StaffRosterAggregate roster,
        IReadOnlyList<RosterExceptionAggregate> exceptions,
        IReadOnlyList<LeaveRequestAggregate> approvedLeave,
        IReadOnlyList<TimeInterval> branchOpenIntervals,
        string timeZoneId,
        DateOnly from,
        DateOnly to,
        bool restrictToOpeningHours)
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var results = new List<StaffAvailableInterval>();

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            // Rule 5: approved leave removes whole days. Requested leave is not passed in here --
            // the caller only supplies Approved leave.
            if (approvedLeave.Any(l => l.StartsOn <= date && date <= l.EndsOn)) continue;

            var daySlots = EffectiveSlots(roster, exceptions, date);

            foreach (var slot in daySlots)
            {
                if (slot.Starts >= slot.Ends) continue;

                var instantStart = BranchCalendar.ToInstant(date, slot.Starts, timeZone);
                var instantEnd = BranchCalendar.ToInstant(date, slot.Ends, timeZone);

                if (restrictToOpeningHours)
                {
                    foreach (var open in branchOpenIntervals)
                    {
                        var overlapStart = instantStart > open.Start ? instantStart : open.Start;
                        var overlapEnd = instantEnd < open.End ? instantEnd : open.End;
                        if (overlapStart < overlapEnd)
                            results.Add(new StaffAvailableInterval(roster.StaffAccountId, roster.BranchId, overlapStart, overlapEnd, false));
                    }
                }
                else
                {
                    var outsideOpeningHours = !branchOpenIntervals.Any(open => open.Start < instantEnd && instantStart < open.End);
                    results.Add(new StaffAvailableInterval(roster.StaffAccountId, roster.BranchId, instantStart, instantEnd, outsideOpeningHours));
                }
            }
        }

        return Merge(results);
    }

    /// <summary>
    /// The day's shifts in branch-local time, before leave and opening hours: the pattern in force (rule 3), minus
    /// <c>ShiftCancelled</c> cuts, plus <c>ExtraShift</c> additions (rule 4). HO-P4 BG-23: cuts are applied to the pattern first and
    /// extras added after, so the outcome no longer depends on the order the exceptions are stored in -- a roster-grid cell is a
    /// whole-day cut plus one extra shift, and the extra must survive its own cut.
    /// </summary>
    public static List<(TimeOnly Starts, TimeOnly Ends)> EffectiveSlots(
        StaffRosterAggregate roster, IReadOnlyList<RosterExceptionAggregate> exceptions, DateOnly date)
    {
        // Rule 3: NextPattern wins once its effective date has arrived.
        var pattern = roster.NextPatternEffectiveFrom is not null && roster.NextPatternEffectiveFrom <= date
            ? roster.NextPattern
            : roster.CurrentPattern;

        var daySlots = pattern
            .Where(s => s.DayOfWeek == date.DayOfWeek)
            .Select(s => (Starts: s.Starts, Ends: s.Ends))
            .ToList();

        var active = exceptions.Where(e => !e.IsCancelled && e.Date == date).ToList();

        foreach (var cut in active.Where(e => e.Kind == RosterExceptionKind.ShiftCancelled))
            daySlots = daySlots.SelectMany(s => Subtract(s, cut.Starts, cut.Ends)).ToList();

        foreach (var extra in active.Where(e => e.Kind == RosterExceptionKind.ExtraShift))
            daySlots.Add((extra.Starts, extra.Ends));

        return daySlots;
    }

    private static IEnumerable<(TimeOnly Starts, TimeOnly Ends)> Subtract(
        (TimeOnly Starts, TimeOnly Ends) slot, TimeOnly cutFrom, TimeOnly cutTo)
    {
        var overlapStart = slot.Starts > cutFrom ? slot.Starts : cutFrom;
        var overlapEnd = slot.Ends < cutTo ? slot.Ends : cutTo;

        if (overlapStart >= overlapEnd)
        {
            yield return slot;
            yield break;
        }

        if (slot.Starts < overlapStart) yield return (slot.Starts, overlapStart);
        if (overlapEnd < slot.Ends) yield return (overlapEnd, slot.Ends);
    }

    private static IReadOnlyList<StaffAvailableInterval> Merge(List<StaffAvailableInterval> intervals)
    {
        if (intervals.Count == 0) return intervals;

        var ordered = intervals.OrderBy(i => i.Start).ToList();
        var merged = new List<StaffAvailableInterval> { ordered[0] };

        foreach (var next in ordered.Skip(1))
        {
            var last = merged[^1];
            if (next.Start <= last.End && next.OutsideOpeningHours == last.OutsideOpeningHours)
            {
                if (next.End > last.End) merged[^1] = last with { End = next.End };
            }
            else
            {
                merged.Add(next);
            }
        }

        return merged;
    }
}
