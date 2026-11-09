using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;

namespace AmarGram.Infrastructure.Notifications;

/// <summary>HO-NTF-001 §8.1/ADR-056 -- adds to the scoped <see cref="AmarGramDbContext"/>
/// without saving. See <see cref="INotificationEnlister"/> for why this exists.</summary>
public sealed class EfNotificationEnlister(AmarGramDbContext db) : INotificationEnlister
{
    public void Enlist(NotificationAggregate notification) => db.Add(notification);
    public void Enlist(AuditEntryAggregate auditEntry) => db.Add(auditEntry);
}
