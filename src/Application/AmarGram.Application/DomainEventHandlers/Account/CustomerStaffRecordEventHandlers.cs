using AmarGram.Domain.Aggregates.Account;
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

/// <summary>HO-P4 BG-19. BusinessEvent audit of a staff note: who added which note to which customer and when. The text is deliberately not
/// in the entry -- it is personal data, and an audit row is never deleted.</summary>
public sealed class AuditCustomerStaffNoteAddedHandler(
    ILogger<AuditCustomerStaffNoteAddedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerStaffNoteAddedEvent>
{
    public async Task HandleAsync(CustomerStaffNoteAddedEvent @event)
    {
        logger.LogInformation("Auditing staff note {NoteId} on customer {CustomerId}. CorrelationId: {CorrelationId}", @event.NoteId, @event.CustomerId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "CustomerAccount", EntityId: @event.CustomerId, Action: "CustomerNoteAdded",
            Reason: "Staff note added", ActorUserId: @event.AuthorStaffId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"NoteId={@event.NoteId}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.BusinessEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}

/// <summary>HO-P4 BG-19. BusinessEvent audit of a tag change; the count only, for the same reason as the note.</summary>
public sealed class AuditCustomerTagsChangedHandler(
    ILogger<AuditCustomerTagsChangedHandler> logger,
    IAggregateRootRepository<AuditEntryAggregate> auditRepository,
    IClientIpAccessor clientIpAccessor,
    TimeProvider timeProvider)
    : IEventHandlerAsync<CustomerTagsChangedEvent>
{
    public async Task HandleAsync(CustomerTagsChangedEvent @event)
    {
        logger.LogInformation("Auditing tag change on customer {CustomerId}. CorrelationId: {CorrelationId}", @event.CustomerId, @event.CorrelationId);

        var entry = new AuditEntryAggregate(Guid.NewGuid());
        entry.Record(new AuditEntryDto(
            EntityType: "CustomerAccount", EntityId: @event.CustomerId, Action: "CustomerTagsChanged",
            Reason: "Staff tags changed", ActorUserId: @event.UserContext.UserId, OccurredOn: timeProvider.GetUtcNow(),
            BeforeValue: null, AfterValue: $"TagCount={@event.TagCount}",
            UserContext: @event.UserContext, CorrelationId: @event.CorrelationId,
            Category: AuditCategory.BusinessEvent, IpAddress: clientIpAccessor.GetClientIpAddress()));

        await auditRepository.SaveAsync(entry, EventPublishOption.DoNotPublish);
    }
}

/// <summary>HO-P4 BG-19. Erasure: the notes and tags are personal data, so anonymising the account clears them (like the address book).</summary>
public sealed class ClearCustomerStaffRecordOnAnonymisedHandler(
    ILogger<ClearCustomerStaffRecordOnAnonymisedHandler> logger,
    IAggregateRootRepository<CustomerStaffRecordAggregate> recordRepository)
    : IEventHandlerAsync<CustomerAccountAnonymisedEvent>
{
    public async Task HandleAsync(CustomerAccountAnonymisedEvent @event)
    {
        var record = await recordRepository.GetByIdAsync(@event.CustomerId);
        if (record is null) return;

        logger.LogInformation("Clearing staff notes and tags for anonymised customer {CustomerId}. CorrelationId: {CorrelationId}", @event.CustomerId, @event.CorrelationId);

        record.Clear(new CustomerStaffRecordClearDto(@event.UserContext, @event.CorrelationId));
        await recordRepository.UpdateAsync(record, EventPublishOption.InMemoryPublishOnly);
    }
}
