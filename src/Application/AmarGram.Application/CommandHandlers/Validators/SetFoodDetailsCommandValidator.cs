using AmarGram.Application.Commands.Product;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SetFoodDetailsCommandValidator : AbstractValidator<SetFoodDetailsCommand>
{
    public SetFoodDetailsCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.IngredientList).MaximumLength(ProductRules.IngredientListMaxLength);
        RuleFor(x => x.StorageInstructions).MaximumLength(ProductRules.StorageInstructionsMaxLength);
        RuleFor(x => x.ShelfLife).MaximumLength(ProductRules.ShelfLifeMaxLength).NoControlCharacters();
        RuleFor(x => x.NetWeight).MaximumLength(ProductRules.NetWeightMaxLength).NoControlCharacters();
        RuleFor(x => x.Allergens).MaximumLength(ProductRules.AllergensMaxLength);
        RuleFor(x => x.OrganicCertifier).MaximumLength(ProductRules.OrganicCertifierMaxLength).NoControlCharacters();
        RuleFor(x => x.OrganicCertificateNumber).MaximumLength(ProductRules.OrganicCertificateNumberMaxLength).NoControlCharacters();
    }
}
