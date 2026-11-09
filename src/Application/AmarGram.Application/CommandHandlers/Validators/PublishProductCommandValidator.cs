using AmarGram.Application.Commands.Product;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class PublishProductCommandValidator : AbstractValidator<PublishProductCommand>
{
    public PublishProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}

/// <summary>HO-P4 BG-10 -- shape only: 1 to <see cref="ProductRules.MaxBulkProducts"/> real ids and a known action. Existence and the
/// transition are decided per product by the handler.</summary>
public sealed class BulkChangeProductStatusCommandValidator : AbstractValidator<BulkChangeProductStatusCommand>
{
    public BulkChangeProductStatusCommandValidator()
    {
        RuleFor(x => x.ProductIds).NotEmpty();
        RuleFor(x => x.ProductIds.Count).LessThanOrEqualTo(ProductRules.MaxBulkProducts).WithName(nameof(BulkChangeProductStatusCommand.ProductIds))
            .WithMessage($"Choose at most {ProductRules.MaxBulkProducts} products at a time.");
        RuleForEach(x => x.ProductIds).NotEmpty();
        RuleFor(x => x.Action).Must(a => BulkProductActions.All.Contains(a, StringComparer.Ordinal))
            .WithErrorCode(BusinessViolationCodes.InvalidBulkAction).WithMessage("Action must be Publish or Unpublish.");
    }
}

public sealed class UnpublishProductCommandValidator : AbstractValidator<UnpublishProductCommand>
{
    public UnpublishProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}

public sealed class ArchiveProductCommandValidator : AbstractValidator<ArchiveProductCommand>
{
    public ArchiveProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}
