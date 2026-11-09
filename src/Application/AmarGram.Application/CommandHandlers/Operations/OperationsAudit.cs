using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Operations;

/// <summary>
/// The one way an Operations handler writes a <c>BusinessEvent</c> audit row (NFR-SEC-8): one row for an act that has no aggregate change of its own
/// (a staff-taken erasure, a purge batch, an issued offline snapshot). The row holds ids, counts and codes -- never a personal value.
/// </summary>
internal static class OperationsAudit
{
    public static async Task WriteBusinessEventAsync(
        IAggregateRootRepository<AuditEntryAggregate> audit, IClientIpAccessor clientIp, DateTimeOffset now, UserContext actor, Guid correlationId,
        string entityType, Guid entityId, string action, string reason, string? afterValue)
    {
        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            entityType, entityId, action, Truncate(reason, 1000), actor.UserId, now, null, afterValue, actor, correlationId,
            AuditCategory.BusinessEvent, clientIp.GetClientIpAddress()));
        await audit.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }

    public static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
