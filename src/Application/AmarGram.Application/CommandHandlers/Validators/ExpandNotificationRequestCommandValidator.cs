using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class ExpandNotificationRequestCommandValidator : AbstractValidator<ExpandNotificationRequestCommand>
{
    public ExpandNotificationRequestCommandValidator() => RuleFor(x => x.RequestId).NotEmpty();
}
