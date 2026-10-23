using AmarGram.Application.Commands.Product;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SetProductImagesCommandValidator : AbstractValidator<SetProductImagesCommand>
{
    public SetProductImagesCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Images).Must(i => i.Count <= ProductRules.MaxImages)
            .WithMessage($"A product may have at most {ProductRules.MaxImages} images.");

        RuleForEach(x => x.Images).ChildRules(image =>
        {
            image.RuleFor(i => i.ImageId).NotEmpty();
            image.RuleFor(i => i.FileId).NotEmpty();
            image.RuleFor(i => i.AltText).NotEmpty().MaximumLength(ProductRules.AltTextMaxLength).NoControlCharacters();
        });
    }
}
