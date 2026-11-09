using AmarGram.Domain.Models;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Administration;

public sealed class CreateBranchCommand : Command
{
    public required Guid BranchId { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public required string TimeZoneId { get; init; }
    public string? AddressLine { get; init; }
    public string? PhoneNumber { get; init; }
    public string? Email { get; init; }
    /// <summary>HO-P4 BG-21: Outlet or Warehouse; absent means Outlet.</summary>
    public string? Type { get; init; }
}

public sealed class UpdateBranchDetailsCommand : Command
{
    public required Guid BranchId { get; init; }
    public required string Name { get; init; }
    public required string TimeZoneId { get; init; }
    public string? AddressLine { get; init; }
    public string? PhoneNumber { get; init; }
    public string? Email { get; init; }
    /// <summary>HO-P4 BG-21: absent leaves the type unchanged.</summary>
    public string? Type { get; init; }
}

public sealed class SetBranchWeeklyHoursCommand : Command
{
    public required Guid BranchId { get; init; }
    public required IReadOnlyList<OpeningIntervalInput> Intervals { get; init; }
}

public sealed class SetBranchActivationCommand : Command
{
    public required Guid BranchId { get; init; }
    public required bool IsActive { get; init; }
}
