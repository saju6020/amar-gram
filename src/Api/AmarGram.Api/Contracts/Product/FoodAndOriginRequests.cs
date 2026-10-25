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

    /// <summary>HO-P4 BG-14 -- last valid day of the organic certificate (yyyy-MM-dd).</summary>
    public DateOnly? OrganicCertificateExpiresOn { get; init; }

    /// <summary>HO-P4 BG-14 -- id of an uploaded file of purpose <c>OrganicCertificate</c> (<c>POST /api/staff/files?purpose=OrganicCertificate</c>); null clears it.</summary>
    public Guid? OrganicCertificateFileId { get; init; }
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
