using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record CustomerNotificationPreferencesOpenDto(UserContext UserContext, Guid CorrelationId);
