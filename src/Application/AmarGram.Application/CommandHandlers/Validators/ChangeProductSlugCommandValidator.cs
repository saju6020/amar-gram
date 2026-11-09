using AmarGram.Application.Commands.Product;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class ChangeProductSlugCommandValidator : AbstractValidator<ChangeProductSlugCommand>
{
    public ChangeProductSlugCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(ProductRules.SlugMaxLength).MustBeSlugFormat();
    }
}
