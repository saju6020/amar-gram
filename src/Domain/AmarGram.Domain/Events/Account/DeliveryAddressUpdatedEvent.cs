using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class DeliveryAddressUpdatedEvent : Event
{
    public required Guid CustomerId { get; init; }
    public required Guid AddressId { get; init; }
}
