using System.Text.Json;
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

/// <summary>Owner, 2026-10-20: audits an administrator's edit of a staff member's name and sign-in identifiers, with
/// that administrator as the actor and the names of the fields changed. The values before and after are in the DataChange row
/// the audit interceptor writes in the same transaction (an event carries no personal data, HO-ACC-001 section 11.5).</summary>
public sealed class AuditStaffAccountDetailsChangedHandler(
    ILogger<AuditStaffAccountDetailsChangedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<StaffAccountDetailsChangedEvent>
{
    public async Task HandleAsync(StaffAccountDetailsChangedEvent @event)
    {
        logger.LogInformation("Auditing staff account details change {StaffAccountId}. CorrelationId: {CorrelationId}", @event.StaffAccountId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "StaffAccount", EntityId: @event.StaffAccountId, Action: "StaffAccountDetailsChanged",
            Reason: "ChangedByAdministrator", ActorUserId: @event.UserContext.UserId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: JsonSerializer.Serialize(new { changedFields = ChangedFields(@event) }),
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.BusinessEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }

    private static string[] ChangedFields(StaffAccountDetailsChangedEvent @event)
    {
        var fields = new List<string>();
        if (@event.FullNameChanged) fields.Add("FullName");
        if (@event.MobileNumberChanged) fields.Add("MobileNumber");
        if (@event.EmailAddressChanged) fields.Add("EmailAddress");
        return [.. fields];
    }
}
