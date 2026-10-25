namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-P4 BG-23. The states a roster-grid cell cycles through. Not persisted: a cell is stored as roster
/// exceptions (<c>RosterCellIds</c>) and read back by classifying the day's effective slots. <c>Custom</c> is
/// read-only (the day's slots match neither preset); it cannot be set.</summary>
public sealed class RosterShift(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly RosterShift Morning = new(1, nameof(Morning));
    public static readonly RosterShift Evening = new(2, nameof(Evening));
    public static readonly RosterShift Off = new(3, nameof(Off));
    public static readonly RosterShift Custom = new(4, nameof(Custom));

    /// <summary>The values a caller may set (everything but <see cref="Custom"/>).</summary>
    public bool IsSettable => this != Custom;
}
