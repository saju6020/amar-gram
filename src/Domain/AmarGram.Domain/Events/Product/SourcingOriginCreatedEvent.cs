using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Product;

public sealed class SourcingOriginCreatedEvent : Event
{
    public required string CountryCode { get; init; }
}
