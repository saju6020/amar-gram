using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Order;

// HO-P4 BG-5 -- the in-house rider registry. Both commands carry the staff member's ACTIVE branch (HO-ADM-001 §8.3): a rider of another branch does not exist for them.

/// <summary>Add a rider to the active branch. The name is unique within the branch.</summary>
public sealed class CreateRiderCommand : Command
{
    public required Guid RiderId { get; init; }
    public required Guid BranchId { get; init; }
    public required string Name { get; init; }
    public string? MobileNumber { get; init; }
    public bool IsActive { get; init; } = true;
}

/// <summary>Rename, change the mobile of, or (de)activate a rider of the active branch. A rider is never deleted.</summary>
public sealed class UpdateRiderCommand : Command
{
    public required Guid RiderId { get; init; }
    public required Guid BranchId { get; init; }
    public required string Name { get; init; }
    public string? MobileNumber { get; init; }
    public bool IsActive { get; init; } = true;
}
