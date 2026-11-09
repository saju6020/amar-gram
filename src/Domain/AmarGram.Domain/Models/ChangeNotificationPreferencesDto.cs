using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record ChangeNotificationPreferencesDto(
    IReadOnlyList<NotificationPreferenceChangeDto> Changes,
    string Source,
    DateTimeOffset RecordedOn,
    UserContext UserContext,
    Guid CorrelationId);
