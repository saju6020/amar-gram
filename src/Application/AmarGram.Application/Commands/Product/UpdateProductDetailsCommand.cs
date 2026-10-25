using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Product;

/// <summary>HO-SHP-001 section 11.1 C2.</summary>
public sealed class UpdateProductDetailsCommand : Command
{
    public required Guid ProductId { get; init; }
    public required int ExpectedVersion { get; init; }
    public required string Name { get; init; }
    public required string Brand { get; init; }
    public string? Description { get; init; }
    public required string Category { get; init; }
    public string? Subcategory { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public required Guid TaxClassId { get; init; }
    public string? CountryOfOriginCode { get; init; }
    public bool ListedOnStorefront { get; init; } = true;
    public bool IsExpiryTracked { get; init; }
    public IReadOnlyList<string> Certifications { get; init; } = [];

    /// <summary>HO-SUB-001 (BG-15) -- "Can be subscribed to". Null leaves the flag as it is, so an older client's PUT never clears it.</summary>
    public bool? IsSubscribable { get; init; }
}
