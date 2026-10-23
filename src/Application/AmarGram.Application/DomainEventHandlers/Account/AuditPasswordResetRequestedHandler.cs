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

/// <summary>HO-ACC-001 §11.6/§11.7. Only raised on the "found" path (§11.4 C4) -- the neutral
/// "not found" path writes nothing, by design (ADR-034).</summary>
public sealed class AuditPasswordResetRequestedHandler(
    ILogger<AuditPasswordResetRequestedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<PasswordResetRequestedEvent>
{
    public async Task HandleAsync(PasswordResetRequestedEvent @event)
    {
        logger.LogInformation("Auditing password reset requested for {AccountKind} {AccountId}. CorrelationId: {CorrelationId}",
            @event.AccountKind, @event.AccountId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: @event.AccountKind.DisplayName + "Account", EntityId: @event.AccountId, Action: "PasswordResetRequested",
            Reason: @event.Channel.DisplayName, ActorUserId: @event.AccountId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"ExpiresOn={@event.ExpiresOn}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.AuthenticationEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
