namespace AmarGram.Read.ViewModels;

/// <summary>HO-P4 BG-23. <paramref name="Shift"/> is Morning, Evening, Off or Custom (the day's hours match neither preset);
/// <paramref name="Slots"/> are the day's effective shifts in branch-local time ("HH:mm"), empty for Off.</summary>
public sealed record RosterCellViewModel(Guid StaffAccountId, Guid BranchId, DateOnly Date, string Shift, IReadOnlyList<RosterCellSlotViewModel> Slots);

public sealed record RosterCellSlotViewModel(string Starts, string Ends);
