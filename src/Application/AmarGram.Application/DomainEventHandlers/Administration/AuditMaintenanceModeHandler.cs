using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Administration;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Application.DomainEventHandlers.Administration;

/// <summary>HO-ADM-001 §11.6.</summary>
public sealed class AuditMaintenanceModeHandler(
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<MaintenanceModeChangedEvent>
{
    public async Task HandleAsync(MaintenanceModeChangedEvent @event)
    {
        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "SystemStatus", EntityId: Shared.Common.Constants.SystemStatusIds.Singleton,
            Action: "MaintenanceModeChanged", Reason: "MaintenanceModeChanged",
            ActorUserId: @event.UserContext.UserId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"MaintenanceMode={@event.MaintenanceMode}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId, Category: AuditCategory.BusinessEvent,
            IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
