using AmarGram.Application.Commands.Account;
using AmarGram.Domain.Models;

namespace AmarGram.Application.DataMappers;

public static class NotificationPreferencesMapper
{
    public static ChangeNotificationPreferencesDto ToChangeDto(
        this ChangeNotificationPreferencesCommand command,
        IReadOnlyList<NotificationPreferenceChangeDto> changes,
        DateTimeOffset recordedOn,
        string source) =>
        new(changes, source, recordedOn, command.UserContext, command.CorrelationId);
}
