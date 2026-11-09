using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Product;

/// <summary>HO-SHP-001 section 11.5 -- a contract other areas may subscribe to.</summary>
public sealed class SkuPriceScheduledEvent : Event
{
    public required Guid SkuId { get; init; }
    public required DateTimeOffset EffectiveFrom { get; init; }
}
