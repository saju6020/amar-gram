using AmarGram.Application.Commands.Product;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class ReactivateSkuCommandValidator : AbstractValidator<ReactivateSkuCommand>
{
    public ReactivateSkuCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.SkuId).NotEmpty();
    }
}
