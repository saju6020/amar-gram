using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SetDefaultDeliveryAddressCommandValidator : AbstractValidator<SetDefaultDeliveryAddressCommand>
{
    public SetDefaultDeliveryAddressCommandValidator() => RuleFor(x => x.AddressId).NotEmpty();
}
