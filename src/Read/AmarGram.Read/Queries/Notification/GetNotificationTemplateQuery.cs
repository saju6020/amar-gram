using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Notification;

/// <summary>HO-NTF-001 §12.4 -- GET /api/admin/notification-templates/{key}.</summary>
public sealed class GetNotificationTemplateQuery : Query<NotificationTemplateDetailViewModel?>
{
    public required string Key { get; init; }
}
