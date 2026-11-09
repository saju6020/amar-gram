using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Application.DomainEventHandlers.Account;

/// <summary>HO-ACC-001 §11.6/§11.7 / US-ACC-13.</summary>
public sealed class AuditCustomerPersonalDataExportedHandler(
    ILogger<AuditCustomerPersonalDataExportedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerPersonalDataExportedEvent>
{
    public async Task HandleAsync(CustomerPersonalDataExportedEvent @event)
    {
        logger.LogInformation("Auditing personal data export {CustomerId}. CorrelationId: {CorrelationId}", @event.CustomerId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "CustomerAccount", EntityId: @event.CustomerId, Action: "CustomerPersonalDataExported",
            Reason: "SelfServiceExport", ActorUserId: @event.UserContext.UserId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: null, UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.BusinessEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
