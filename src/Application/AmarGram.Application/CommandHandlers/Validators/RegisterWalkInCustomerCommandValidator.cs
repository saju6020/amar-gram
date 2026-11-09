using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RegisterWalkInCustomerCommandValidator : AbstractValidator<RegisterWalkInCustomerCommand>
{
    public RegisterWalkInCustomerCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MobileNumber).NotEmpty();
    }
}
