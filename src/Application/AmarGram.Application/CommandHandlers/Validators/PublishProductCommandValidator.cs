using AmarGram.Application.Commands.Product;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class PublishProductCommandValidator : AbstractValidator<PublishProductCommand>
{
    public PublishProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}

public sealed class UnpublishProductCommandValidator : AbstractValidator<UnpublishProductCommand>
{
    public UnpublishProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}

public sealed class ArchiveProductCommandValidator : AbstractValidator<ArchiveProductCommand>
{
    public ArchiveProductCommandValidator() => RuleFor(x => x.ProductId).NotEmpty();
}
