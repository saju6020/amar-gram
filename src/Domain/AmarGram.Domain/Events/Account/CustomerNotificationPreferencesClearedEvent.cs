using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class CustomerNotificationPreferencesClearedEvent : Event
{
    public required Guid CustomerId { get; init; }
}
