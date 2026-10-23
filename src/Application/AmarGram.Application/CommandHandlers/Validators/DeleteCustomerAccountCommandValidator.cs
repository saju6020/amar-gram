using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class DeleteCustomerAccountCommandValidator : AbstractValidator<DeleteCustomerAccountCommand>
{
    public DeleteCustomerAccountCommandValidator() =>
        RuleFor(x => x.CurrentPassword).NotEmpty().MaximumLength(256);
}
