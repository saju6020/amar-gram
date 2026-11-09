using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RecordStaffSessionActivityCommandValidator : AbstractValidator<RecordStaffSessionActivityCommand>
{
    public RecordStaffSessionActivityCommandValidator() => RuleFor(x => x.TokenHash).NotEmpty();
}
