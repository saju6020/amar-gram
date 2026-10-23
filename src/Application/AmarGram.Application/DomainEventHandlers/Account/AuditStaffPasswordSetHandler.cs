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

/// <summary>HO-ACC-001 §11.6/§11.7. Owner, 2026-10-19 (SECURITY gate HIGH): a password an administrator set for someone
/// else is audited with that administrator as the actor and reason <c>SetByAdministrator</c> (or
/// <c>InitialPasswordByAdministrator</c> at creation), never as the staff member's own reset.</summary>
public sealed class AuditStaffPasswordSetHandler(
    ILogger<AuditStaffPasswordSetHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<StaffPasswordSetEvent>
{
    public async Task HandleAsync(StaffPasswordSetEvent @event)
    {
        logger.LogInformation("Auditing staff password set {StaffAccountId}. CorrelationId: {CorrelationId}", @event.StaffAccountId, @event.CorrelationId);

        var setByAdministrator = @event.SetByAdministratorId is { } adminId && adminId != @event.StaffAccountId ? adminId : (Guid?)null;
        var reason = setByAdministrator is not null
            ? (@event.WasFirstPassword ? "InitialPasswordByAdministrator" : "SetByAdministrator")
            : (@event.WasFirstPassword ? "FirstPassword" : "PasswordReset");

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "StaffAccount", EntityId: @event.StaffAccountId, Action: "StaffPasswordSet",
            Reason: reason, ActorUserId: setByAdministrator ?? @event.StaffAccountId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: null, UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.AuthenticationEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}
