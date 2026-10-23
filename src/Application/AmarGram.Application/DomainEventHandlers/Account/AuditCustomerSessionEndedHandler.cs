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

/// <summary>HO-ACC-001 §11.6/§11.7.</summary>
public sealed class AuditCustomerSessionEndedHandler(
    ILogger<AuditCustomerSessionEndedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerSessionEndedEvent>
{
    public async Task HandleAsync(CustomerSessionEndedEvent @event)
    {
        logger.LogInformation("Auditing customer session ended {SessionId}. CorrelationId: {CorrelationId}", @event.SessionId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "CustomerSession", EntityId: @event.SessionId, Action: "CustomerSessionEnded",
            Reason: @event.Reason.DisplayName, ActorUserId: @event.CustomerAccountId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: null, UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.AuthenticationEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
