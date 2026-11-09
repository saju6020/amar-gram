using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Administration;

public sealed class StaffBranchesAssignedEvent : Event
{
    public required Guid StaffAccountId { get; init; }
}
