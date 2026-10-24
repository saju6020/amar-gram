using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-P4 BG-19.</summary>
public sealed record CustomerStaffRecordOpenDto(UserContext UserContext, Guid CorrelationId);

public sealed record CustomerNoteAddDto(
    Guid NoteId, Guid AuthorStaffId, string Text, DateTimeOffset AddedOn, UserContext UserContext, Guid CorrelationId);

public sealed record CustomerTagsSetDto(IReadOnlyList<string> Tags, UserContext UserContext, Guid CorrelationId);

/// <summary>Anonymisation only.</summary>
public sealed record CustomerStaffRecordClearDto(UserContext UserContext, Guid CorrelationId);
