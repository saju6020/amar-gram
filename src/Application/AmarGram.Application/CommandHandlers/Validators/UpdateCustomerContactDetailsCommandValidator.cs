using AmarGram.Application.Commands.Account;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class UpdateCustomerContactDetailsCommandValidator : AbstractValidator<UpdateCustomerContactDetailsCommand>
{
    public UpdateCustomerContactDetailsCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.EmailAddress).MaximumLength(EmailAddress.MaxLength);
        RuleFor(x => x.AdditionalPhoneNumbers).Must(n => n.Count <= CustomerProfileRules.MaxAdditionalPhoneNumbers)
            .WithMessage($"No more than {CustomerProfileRules.MaxAdditionalPhoneNumbers} additional phone numbers are allowed.");
        RuleForEach(x => x.AdditionalPhoneNumbers).MaximumLength(MobileNumber.MaxLength);
    }
}
