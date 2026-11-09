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
public sealed class AuditStaffSignInFailedHandler(
    ILogger<AuditStaffSignInFailedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<StaffSignInFailedEvent>
{
    public async Task HandleAsync(StaffSignInFailedEvent @event)
    {
        logger.LogInformation("Auditing staff sign-in failure {AccountId}. CorrelationId: {CorrelationId}", @event.AccountId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "StaffAccount", EntityId: @event.AccountId, Action: "StaffSignInFailed",
            Reason: @event.Outcome.DisplayName, ActorUserId: @event.AccountId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"ConsecutiveFailures={@event.ConsecutiveFailures};LockedUntil={@event.LockedUntil}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.AuthenticationEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
