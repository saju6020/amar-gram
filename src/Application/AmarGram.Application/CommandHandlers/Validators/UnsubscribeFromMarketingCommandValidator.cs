using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class UnsubscribeFromMarketingCommandValidator : AbstractValidator<UnsubscribeFromMarketingCommand>
{
    public UnsubscribeFromMarketingCommandValidator() =>
        RuleFor(x => x.Token).NotEmpty().MaximumLength(100).NoControlCharacters();
}
