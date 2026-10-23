using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SignInStaffCommandValidator : AbstractValidator<SignInStaffCommand>
{
    public SignInStaffCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.Identifier).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(256);
    }
}
