using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RedactNotificationSecretsCommandValidator : AbstractValidator<RedactNotificationSecretsCommand>
{
    public RedactNotificationSecretsCommandValidator() =>
        RuleFor(x => x).Must(x => (x.RequestId is null) != (x.NotificationId is null))
            .WithMessage("Exactly one of RequestId or NotificationId is required.");
}
