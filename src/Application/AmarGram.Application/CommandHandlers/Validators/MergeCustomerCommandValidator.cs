using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class MergeCustomerCommandValidator : AbstractValidator<MergeCustomerCommand>
{
    public MergeCustomerCommandValidator()
    {
        RuleFor(x => x.DuplicateCustomerId).NotEmpty();
        RuleFor(x => x.SurvivingCustomerId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(1000);
    }
}
