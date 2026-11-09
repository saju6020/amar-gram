using AmarGram.Application.Commands.Product;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class UpdateProductDetailsCommandValidator : AbstractValidator<UpdateProductDetailsCommand>
{
    public UpdateProductDetailsCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ProductRules.NameMaxLength).NoControlCharacters();
        RuleFor(x => x.Brand).NotEmpty().MaximumLength(ProductRules.BrandMaxLength).NoControlCharacters();
        RuleFor(x => x.DistrictOfOrigin).MaximumLength(ProductRules.DistrictMaxLength).NoControlCharacters(); // HO-P3 G1
        RuleFor(x => x.Description).MaximumLength(ProductRules.DescriptionMaxLength);
        RuleFor(x => x.Category).NotEmpty().MustBeValidEnumeration<UpdateProductDetailsCommand, ProductCategory>();
        RuleFor(x => x.Subcategory).MustBeValidEnumeration<UpdateProductDetailsCommand, ProductSubcategory>();
        RuleFor(x => x.TaxClassId).NotEmpty();
        RuleForEach(x => x.Certifications).MustBeValidEnumeration<UpdateProductDetailsCommand, Certification>();
        RuleFor(x => x.Tags).Must(t => t.Count <= ProductRules.MaxTags)
            .WithMessage($"A product may have at most {ProductRules.MaxTags} tags.");
        RuleFor(x => x.Certifications).Must(t => t.Count <= ProductRules.MaxCertifications)
            .WithMessage($"A product may have at most {ProductRules.MaxCertifications} certifications.");
    }
}
