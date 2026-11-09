namespace AmarGram.Domain.Entities;

/// <summary>HO-P4 BG-19. One staff note on a customer. Owned by <c>CustomerStaffRecordAggregate</c>; append-only (there is no edit or delete
/// of a single note -- a record of what staff knew and when). Free text, so personal data: it never leaves the aggregate in an event.</summary>
public sealed class CustomerStaffNote
{
    public Guid Id { get; private set; }
    public Guid AuthorStaffId { get; private set; }
    public string Text { get; private set; } = default!;
    public DateTimeOffset CreatedOn { get; private set; }

    private CustomerStaffNote() { }

    public CustomerStaffNote(Guid id, Guid authorStaffId, string text, DateTimeOffset createdOn)
    {
        Id = id;
        AuthorStaffId = authorStaffId;
        Text = text;
        CreatedOn = createdOn;
    }
}
