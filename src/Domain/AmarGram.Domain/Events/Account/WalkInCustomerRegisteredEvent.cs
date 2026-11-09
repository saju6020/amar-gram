using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class WalkInCustomerRegisteredEvent : Event
{
    public required Guid CustomerId { get; init; }
}
