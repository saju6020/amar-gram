namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-ADM-001 §10.3.</summary>
public static class StaffRosterRules
{
    public static readonly IReadOnlyList<string> RosterableRoles =
    [
        StaffRoles.Reception
    ];

    public const int MaxSlotsPerDay = 3;
}
