using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Notifications;

/// <summary>HO-NTF-001 §11.4 C7/§12.6. See <see cref="INotificationResendCounter"/>.</summary>
public sealed class EfNotificationResendCounter(AmarGramDbContext db) : INotificationResendCounter
{
    public Task<int> CountResendsAsync(Guid chainRootId, CancellationToken ct = default) =>
        db.Notifications.AsNoTracking().CountAsync(n => n.ResendOfId == chainRootId, ct);
}
