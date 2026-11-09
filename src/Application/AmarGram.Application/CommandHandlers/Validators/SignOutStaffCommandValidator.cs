using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SignOutStaffCommandValidator : AbstractValidator<SignOutStaffCommand>
{
    public SignOutStaffCommandValidator() => RuleFor(x => x.TokenHash).NotEmpty();
}
