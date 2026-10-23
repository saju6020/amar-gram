using AmarGram.Application.Commands.Notification;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

/// <summary>HO-NTF-001 §11.2 C7 -- Channel, if present, must be one of the deliverable external
/// channels (never InApp -- a resend is never to the inbox).</summary>
public sealed class ResendNotificationCommandValidator : AbstractValidator<ResendNotificationCommand>
{
    public ResendNotificationCommandValidator()
    {
        RuleFor(x => x.NotificationId).NotEmpty();
        RuleFor(x => x.NewNotificationId).NotEmpty();
        RuleFor(x => x.Channel).MustBeValidEnumeration<ResendNotificationCommand, NotificationChannel>()
            .Must(v => v is null || (NotificationChannelRules.DeliverableChannels
                .Where(c => c != NotificationChannel.InApp)
                .Any(c => string.Equals(c.DisplayName, v, StringComparison.OrdinalIgnoreCase))))
            .When(x => !string.IsNullOrEmpty(x.Channel))
            .WithMessage("Channel must be Sms or Email.");
    }
}
