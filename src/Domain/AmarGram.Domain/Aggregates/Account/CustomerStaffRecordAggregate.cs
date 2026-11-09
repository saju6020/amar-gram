using AmarGram.Domain.Entities;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Account;

/// <summary>
/// HO-P4 BG-19. What staff keep about a customer: free-text notes (append-only, author and time) and free labels (tags). Id is the customer
/// id -- a 1:1 shared key created on first write, the same shape as <see cref="CustomerAddressBookAggregate"/>, and for the same reason: it is
/// personal data with its own lifecycle, so anonymisation clears it through <see cref="Clear"/> without touching the account row. Whether the
/// customer is active is a cross-aggregate check (the handler's); everything about the notes and tags themselves is checked here.
/// </summary>
public sealed class CustomerStaffRecordAggregate : AggregateRoot
{
    private readonly List<CustomerStaffNote> _notes = [];
    private readonly List<string> _labels = [];

    public IReadOnlyList<CustomerStaffNote> Notes => _notes;

    /// <summary>The tags, in the order staff entered them (the base class already has an unrelated <c>Tags</c> property).</summary>
    public IReadOnlyList<string> Labels => _labels;

    private CustomerStaffRecordAggregate() { }

    public CustomerStaffRecordAggregate(Guid id) : base(id) { }

    public void Open(CustomerStaffRecordOpenDto dto)
    {
        SetDefaultValue(dto.UserContext);
        UpdateVersion();
    }

    public void AddNote(CustomerNoteAddDto dto)
    {
        var text = dto.Text?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > CustomerStaffRecordRules.NoteMaxLength)
            throw Violation(BusinessViolationCodes.InvalidCustomerNote,
                $"A note must be between 1 and {CustomerStaffRecordRules.NoteMaxLength} characters.", nameof(dto.Text));

        if (_notes.Count >= CustomerStaffRecordRules.MaxNotes)
            throw Violation(BusinessViolationCodes.CustomerNoteLimitExceeded,
                $"No more than {CustomerStaffRecordRules.MaxNotes} notes are kept on one customer.", nameof(dto.Text));

        _notes.Add(new CustomerStaffNote(dto.NoteId, dto.AuthorStaffId, text, dto.AddedOn));

        AddDomainEvent(new CustomerStaffNoteAddedEvent
        {
            CustomerId = Id, NoteId = dto.NoteId, AuthorStaffId = dto.AuthorStaffId,
            CorrelationId = dto.CorrelationId, UserContext = dto.UserContext
        });

        UpdateVersion();
    }

    /// <summary>Replaces the whole tag set (the screen edits the set). Tags are trimmed, compared case-insensitively and de-duplicated, keeping
    /// the first spelling; setting the set the customer already has changes nothing and raises nothing.</summary>
    public void SetTags(CustomerTagsSetDto dto)
    {
        var cleaned = new List<string>();
        foreach (var raw in dto.Tags ?? [])
        {
            var tag = raw?.Trim();
            if (string.IsNullOrEmpty(tag) || tag.Length > CustomerStaffRecordRules.TagMaxLength || tag.Any(char.IsControl))
                throw Violation(BusinessViolationCodes.InvalidCustomerTag,
                    $"A tag must be between 1 and {CustomerStaffRecordRules.TagMaxLength} characters.", nameof(dto.Tags));

            if (!cleaned.Contains(tag, StringComparer.OrdinalIgnoreCase)) cleaned.Add(tag);
        }

        if (cleaned.Count > CustomerStaffRecordRules.MaxTags)
            throw Violation(BusinessViolationCodes.CustomerTagLimitExceeded,
                $"No more than {CustomerStaffRecordRules.MaxTags} tags are allowed on one customer.", nameof(dto.Tags));

        if (_labels.SequenceEqual(cleaned, StringComparer.Ordinal)) return;

        _labels.Clear();
        _labels.AddRange(cleaned);

        AddDomainEvent(new CustomerTagsChangedEvent
        {
            CustomerId = Id, TagCount = _labels.Count, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext
        });

        UpdateVersion();
    }

    /// <summary>Anonymisation only. Idempotent: an already-empty record raises nothing.</summary>
    public void Clear(CustomerStaffRecordClearDto dto)
    {
        if (_notes.Count == 0 && _labels.Count == 0) return;

        _notes.Clear();
        _labels.Clear();

        AddDomainEvent(new CustomerStaffRecordClearedEvent { CustomerId = Id, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext });

        UpdateVersion();
    }

    private static DomainRuleViolationException Violation(string code, string message, string property) => new(code, message, property);
}
