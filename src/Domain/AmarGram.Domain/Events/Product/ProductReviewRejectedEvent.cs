using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Product;

public sealed class ProductReviewRejectedEvent : Event
{
    public required Guid ReviewId { get; init; }
    public required Guid ProductId { get; init; }
    public required int Reason { get; init; }
}
