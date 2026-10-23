using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Product;

/// <summary>HO-SHP-001 section 11.1 C12.</summary>
public sealed class HideProductReviewCommand : Command
{
    public required Guid ReviewId { get; init; }
}
