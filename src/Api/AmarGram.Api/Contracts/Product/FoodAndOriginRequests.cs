namespace AmarGram.Api.Contracts.Product;

public sealed class SetFoodDetailsRequest
{
    public required int ExpectedVersion { get; init; }
    public string? IngredientList { get; init; }
    public string? StorageInstructions { get; init; }
    public string? ShelfLife { get; init; }
    public string? NetWeight { get; init; }
    public string? Allergens { get; init; }
    public string? OrganicCertifier { get; init; }
    public string? OrganicCertificateNumber { get; init; }
}

public sealed class SourcingOriginRequest
{
    public string? SourcingNotes { get; init; }
    public bool IsFeatured { get; init; }
    public int SortOrder { get; init; }
}

public sealed class CreateSourcingOriginRequest
{
    public required string CountryCode { get; init; }
    public string? SourcingNotes { get; init; }
    public bool IsFeatured { get; init; }
    public int SortOrder { get; init; }
}
