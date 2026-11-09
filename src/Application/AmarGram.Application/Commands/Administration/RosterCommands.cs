using AmarGram.Domain.Models;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Administration;

public sealed class SetRosterPatternCommand : Command
{
    public required Guid StaffAccountId { get; init; }
    public required Guid BranchId { get; init; }
    public required IReadOnlyList<ShiftSlotInput> Slots { get; init; }
    public DateOnly? EffectiveFrom { get; init; }
}

public sealed class CancelScheduledRosterPatternCommand : Command
{
    public required Guid StaffAccountId { get; init; }
    public required Guid BranchId { get; init; }
}

public sealed class CreateRosterExceptionCommand : Command
{
    public required Guid RosterExceptionId { get; init; }
    public required Guid StaffAccountId { get; init; }
    public required Guid BranchId { get; init; }
    public required DateOnly Date { get; init; }
    public required string Kind { get; init; }
    public required TimeOnly Starts { get; init; }
    public required TimeOnly Ends { get; init; }
    public required string Reason { get; init; }
}

/// <summary>HO-P4 BG-23 -- one roster-grid cell: <see cref="Shift"/> is Morning, Evening or Off.</summary>
public sealed class SetRosterShiftCommand : Command
{
    public required Guid StaffAccountId { get; init; }
    public required Guid BranchId { get; init; }
    public required DateOnly Date { get; init; }
    public required string Shift { get; init; }
}

public sealed class CancelRosterExceptionCommand : Command
{
    public required Guid BranchId { get; init; }
    public required Guid RosterExceptionId { get; init; }
}
