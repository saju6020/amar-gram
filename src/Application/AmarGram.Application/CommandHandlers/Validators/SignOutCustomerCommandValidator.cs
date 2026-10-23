using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SignOutCustomerCommandValidator : AbstractValidator<SignOutCustomerCommand>
{
    public SignOutCustomerCommandValidator() => RuleFor(x => x.TokenHash).NotEmpty();
}
