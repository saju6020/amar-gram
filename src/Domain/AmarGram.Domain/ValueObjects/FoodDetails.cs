using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.ValueObjects;

/// <summary>
/// HO-SHP-001 section 8.5, HO-P2 §1.3 -- owned one, optional, food-only columns on <c>product.product</c>:
/// the generic food label (ingredients, storage, shelf life, net weight, allergens) and the organic
/// certificate. Every field is optional here; publishing a <c>CertifiedOrganic</c> product needs the
/// certifier and certificate number (<see cref="HasOrganicCertificate"/>, checked by
/// <c>ProductPublicationRules</c>).
/// </summary>
public sealed record FoodDetails
{
    public string? IngredientList { get; private set; }
    public string? StorageInstructions { get; private set; }
    public string? ShelfLife { get; private set; }
    public string? NetWeight { get; private set; }
    public string? Allergens { get; private set; }
    public string? OrganicCertifier { get; private set; }
    public string? OrganicCertificateNumber { get; private set; }

    /// <summary>EF Core materialises this owned type by property injection (a parameterless
    /// constructor), not constructor binding.</summary>
    private FoodDetails()
    {
    }

    public FoodDetails(string? ingredientList, string? storageInstructions, string? shelfLife, string? netWeight,
        string? allergens, string? organicCertifier, string? organicCertificateNumber)
    {
        IngredientList = Checked(ingredientList, ProductRules.IngredientListMaxLength, "Ingredient list", nameof(IngredientList));
        StorageInstructions = Checked(storageInstructions, ProductRules.StorageInstructionsMaxLength, "Storage instructions", nameof(StorageInstructions));
        ShelfLife = Checked(shelfLife, ProductRules.ShelfLifeMaxLength, "Shelf life", nameof(ShelfLife));
        NetWeight = Checked(netWeight, ProductRules.NetWeightMaxLength, "Net weight", nameof(NetWeight));
        Allergens = Checked(allergens, ProductRules.AllergensMaxLength, "Allergens", nameof(Allergens));
        OrganicCertifier = Checked(organicCertifier, ProductRules.OrganicCertifierMaxLength, "Organic certifier", nameof(OrganicCertifier));
        OrganicCertificateNumber = Checked(organicCertificateNumber, ProductRules.OrganicCertificateNumberMaxLength, "Organic certificate number", nameof(OrganicCertificateNumber));
    }

    /// <summary>US-SHP-03 AC1's labelling checklist (OQ-3) -- which fields are present, for the
    /// "LabellingComplete" warning-only publication item. Allergens are free text and may rightly be empty.</summary>
    public bool HasFullLabelling =>
        IngredientList is not null && StorageInstructions is not null && ShelfLife is not null && NetWeight is not null;

    /// <summary>HO-P2 §1.3 -- both the certifier and the certificate number are present.</summary>
    public bool HasOrganicCertificate => OrganicCertifier is not null && OrganicCertificateNumber is not null;

    private static string? Checked(string? value, int maxLength, string label, string property)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new DomainRuleViolationException(BusinessViolationCodes.FoodDetailsOnlyForFood, $"{label} cannot exceed {maxLength} characters.", property);

        return trimmed;
    }
}
