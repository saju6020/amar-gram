using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Domain.DomainServices;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Infrastructure.Notifications;

/// <summary>HO-NTF-001 §8.6/§11.4 C5. See <see cref="INotificationClaimStore"/>.</summary>
public sealed class EfNotificationClaimStore(IAggregateRootRepository<NotificationAggregate> repository) : INotificationClaimStore
{
    public async Task<bool> TrySaveClaimAsync(NotificationAggregate notification, CancellationToken ct = default)
    {
        try
        {
            await repository.UpdateAsync(notification, EventPublishOption.InMemoryPublishOnly);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }
}
