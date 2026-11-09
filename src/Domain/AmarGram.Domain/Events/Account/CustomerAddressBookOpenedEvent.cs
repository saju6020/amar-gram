using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class CustomerAddressBookOpenedEvent : Event
{
    public required Guid CustomerId { get; init; }
}
