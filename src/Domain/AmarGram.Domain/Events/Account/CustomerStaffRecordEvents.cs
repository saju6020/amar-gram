using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

/// <summary>HO-P4 BG-19. Ids and counts only -- the note text and the tags are personal data and are never put on an event
/// (<c>EventPersonalDataReflectionTests</c>).</summary>
public sealed class CustomerStaffNoteAddedEvent : Event
{
    public required Guid CustomerId { get; init; }
    public required Guid NoteId { get; init; }
    public required Guid AuthorStaffId { get; init; }
}

public sealed class CustomerTagsChangedEvent : Event
{
    public required Guid CustomerId { get; init; }
    public required int TagCount { get; init; }
}

public sealed class CustomerStaffRecordClearedEvent : Event
{
    public required Guid CustomerId { get; init; }
}
