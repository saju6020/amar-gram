using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class DeliverNotificationCommandValidator : AbstractValidator<DeliverNotificationCommand>
{
    public DeliverNotificationCommandValidator() => RuleFor(x => x.NotificationId).NotEmpty();
}
