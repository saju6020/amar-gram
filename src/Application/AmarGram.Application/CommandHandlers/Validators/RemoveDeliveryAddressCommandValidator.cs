using AmarGram.Application.Commands.Account;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RemoveDeliveryAddressCommandValidator : AbstractValidator<RemoveDeliveryAddressCommand>
{
    public RemoveDeliveryAddressCommandValidator() => RuleFor(x => x.AddressId).NotEmpty();
}
