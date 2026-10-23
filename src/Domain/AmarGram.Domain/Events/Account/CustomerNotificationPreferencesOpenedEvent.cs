using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class CustomerNotificationPreferencesOpenedEvent : Event
{
    public required Guid CustomerId { get; init; }
}
