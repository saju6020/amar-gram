using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-P4 BG-23 -- pure. Names a day's effective shifts (<see cref="StaffAvailability.EffectiveSlots"/>) for the roster grid:
/// no slot is <c>Off</c>, exactly the Morning or the Evening preset is that preset, anything else is <c>Custom</c> (the weekly
/// pattern's own hours, or an exception the cell command did not write). The presets are <see cref="StaffRosterRules"/>'s.
/// </summary>
public static class RosterShiftCells
{
    public static RosterShift Classify(IReadOnlyList<(TimeOnly Starts, TimeOnly Ends)> slots)
    {
        var real = slots.Where(s => s.Starts < s.Ends).ToList();
        if (real.Count == 0) return RosterShift.Off;
        if (real.Count == 1)
        {
            var only = real[0];
            if (only == (StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds)) return RosterShift.Morning;
            if (only == (StaffRosterRules.EveningStarts, StaffRosterRules.EveningEnds)) return RosterShift.Evening;
        }

        return RosterShift.Custom;
    }

    public static (TimeOnly Starts, TimeOnly Ends) Hours(RosterShift shift) =>
        shift == RosterShift.Morning ? (StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds)
        : shift == RosterShift.Evening ? (StaffRosterRules.EveningStarts, StaffRosterRules.EveningEnds)
        : throw new ArgumentOutOfRangeException(nameof(shift), "Only Morning and Evening have hours.");
}
