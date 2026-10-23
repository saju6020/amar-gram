using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RefreshStaffSessionCsrfTokenCommandValidator : AbstractValidator<RefreshStaffSessionCsrfTokenCommand>
{
    public RefreshStaffSessionCsrfTokenCommandValidator() => RuleFor(x => x.TokenHash).NotEmpty();
}
