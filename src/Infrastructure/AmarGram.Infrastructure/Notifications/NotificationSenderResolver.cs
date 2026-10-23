using System.Collections.Concurrent;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Configuration;
using AmarGram.Infrastructure.Notifications.Senders;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AmarGram.Infrastructure.Notifications;

/// <summary>
/// HO-NTF-001 §8.9/§12.2/§12.7 -- Singleton. Resolves the sender configured for a channel
/// (<c>Notifications:Channels:{Sms|Email}:Sender</c>), caching one instance per channel for the
/// process lifetime so a test can script a <see cref="CapturingChannelSender"/>'s outcomes.
/// </summary>
public sealed class NotificationSenderResolver(IOptions<NotificationOptions> options, IHostEnvironment environment, ILoggerFactory loggerFactory)
    : INotificationChannelSenderResolver
{
    private readonly ConcurrentDictionary<NotificationChannel, INotificationChannelSender> _cache = new();

    public INotificationChannelSender Resolve(NotificationChannel channel)
    {
        return _cache.GetOrAdd(channel, Build);
    }

    private INotificationChannelSender Build(NotificationChannel channel)
    {
        var kind = channel == NotificationChannel.Sms ? options.Value.Channels.Sms.Sender : options.Value.Channels.Email.Sender;

        return kind switch
        {
            "Development" => new DevelopmentChannelSender(channel, environment, loggerFactory.CreateLogger<DevelopmentChannelSender>()),
            "Capturing" => new CapturingChannelSender(channel, environment),
            _ => new UnconfiguredChannelSender(channel)
        };
    }
}
