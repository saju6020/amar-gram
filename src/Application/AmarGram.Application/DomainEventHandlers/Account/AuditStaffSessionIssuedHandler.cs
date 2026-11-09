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
public sealed class AuditStaffSessionIssuedHandler(
    ILogger<AuditStaffSessionIssuedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<StaffSessionIssuedEvent>
{
    public async Task HandleAsync(StaffSessionIssuedEvent @event)
    {
        logger.LogInformation("Auditing staff session issued {SessionId}. CorrelationId: {CorrelationId}", @event.SessionId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "StaffSession", EntityId: @event.SessionId, Action: "StaffSessionIssued",
            Reason: "SignIn", ActorUserId: @event.StaffAccountId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"ExpiresOn={@event.ExpiresOn}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.AuthenticationEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
