using AmarGram.Application.Commands.Notification;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RecordNotificationExpansionFailureCommandValidator : AbstractValidator<RecordNotificationExpansionFailureCommand>
{
    public RecordNotificationExpansionFailureCommandValidator() => RuleFor(x => x.RequestId).NotEmpty();
}
