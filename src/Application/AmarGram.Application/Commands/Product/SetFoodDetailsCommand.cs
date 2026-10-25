using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Product;

/// <summary>HO-SHP-001 section 11.1 C8; HO-P2 §1.3 -- the generic food label and the organic certificate.</summary>
public sealed class SetFoodDetailsCommand : Command
{
    public required Guid ProductId { get; init; }
    public required int ExpectedVersion { get; init; }
    public string? IngredientList { get; init; }
    public string? StorageInstructions { get; init; }
    public string? ShelfLife { get; init; }
    public string? NetWeight { get; init; }
    public string? Allergens { get; init; }
    public string? OrganicCertifier { get; init; }
    public string? OrganicCertificateNumber { get; init; }

    /// <summary>HO-P4 BG-14 -- last day the organic certificate is valid (inclusive).</summary>
    public DateOnly? OrganicCertificateExpiresOn { get; init; }

    /// <summary>HO-P4 BG-14 -- a stored file of purpose <c>OrganicCertificate</c> (the id the upload returned); null removes the file.</summary>
    public Guid? OrganicCertificateFileId { get; init; }
}
