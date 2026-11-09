using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RefreshCustomerSessionCsrfTokenCommandValidator : AbstractValidator<RefreshCustomerSessionCsrfTokenCommand>
{
    public RefreshCustomerSessionCsrfTokenCommandValidator() => RuleFor(x => x.TokenHash).NotEmpty();
}
