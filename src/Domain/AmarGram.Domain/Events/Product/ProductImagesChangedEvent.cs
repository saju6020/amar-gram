using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Product;

public sealed class ProductImagesChangedEvent : Event
{
    public required Guid ProductId { get; init; }
}
