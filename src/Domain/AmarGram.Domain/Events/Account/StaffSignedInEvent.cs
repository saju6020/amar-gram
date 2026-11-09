using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class StaffSignedInEvent : Event
{
    public required Guid AccountId { get; init; }
    public required DateTimeOffset OccurredOn { get; init; }
}
