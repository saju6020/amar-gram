using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class MarkInboxItemReadCommandValidator : AbstractValidator<MarkInboxItemReadCommand>
{
    public MarkInboxItemReadCommandValidator() => RuleFor(x => x.NotificationId).NotEmpty();
}
