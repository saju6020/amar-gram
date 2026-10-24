namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-ADM-001 §10.3.</summary>
public static class StaffRosterRules
{
    public static readonly IReadOnlyList<string> RosterableRoles =
    [
        StaffRoles.Reception
    ];

    public const int MaxSlotsPerDay = 3;

    // HO-P4 BG-23: the roster grid's cell presets, in branch-local time at HH:mm precision (the pattern editor's precision).
    public static readonly TimeOnly MorningStarts = new(8, 0);
    public static readonly TimeOnly MorningEnds = new(14, 0);
    public static readonly TimeOnly EveningStarts = new(14, 0);
    public static readonly TimeOnly EveningEnds = new(20, 0);

    /// <summary>The whole local day as the roster exception model can express it (an exception needs Starts &lt; Ends).</summary>
    public static readonly TimeOnly DayStarts = new(0, 0);
    public static readonly TimeOnly DayEnds = new(23, 59);
}
