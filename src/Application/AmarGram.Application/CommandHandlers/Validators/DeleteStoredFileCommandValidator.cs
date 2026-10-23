using AmarGram.Application.Commands.StoredFile;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class DeleteStoredFileCommandValidator : AbstractValidator<DeleteStoredFileCommand>
{
    public DeleteStoredFileCommandValidator()
    {
        RuleFor(x => x.FileId).NotEmpty();
    }
}
