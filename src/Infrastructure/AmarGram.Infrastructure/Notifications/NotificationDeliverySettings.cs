using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace AmarGram.Infrastructure.Notifications;

/// <summary>HO-NTF-001 §12.2. See <see cref="INotificationDeliverySettings"/>.</summary>
public sealed class NotificationDeliverySettings(IOptions<NotificationOptions> options) : INotificationDeliverySettings
{
    public int SendTimeoutSeconds => options.Value.Worker.SendTimeoutSeconds;
    public int LeaseSeconds => options.Value.Worker.LeaseSeconds;
}
