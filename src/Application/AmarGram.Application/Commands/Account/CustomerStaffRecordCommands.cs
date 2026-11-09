using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

/// <summary>HO-P4 BG-19 -- add a staff note to a customer. The author is the calling staff member (<c>UserContext.UserId</c>).</summary>
public sealed class AddCustomerNoteCommand : Command
{
    public required Guid CustomerId { get; init; }
    public required Guid NoteId { get; init; }
    public required string Text { get; init; }
}

/// <summary>HO-P4 BG-19 -- replace a customer's tag set.</summary>
public sealed class SetCustomerTagsCommand : Command
{
    public required Guid CustomerId { get; init; }
    public required IReadOnlyList<string> Tags { get; init; }
}

/// <summary>HO-P4 BG-19 -- staff starts a password reset for a customer. Reuses the self-service reset: the same token, expiry, notification and
/// confirm step, sent to the customer's own mobile (else email) -- the link never goes to, or is shown to, the staff member.</summary>
public sealed class RequestCustomerPasswordResetCommand : Command
{
    public required Guid CustomerId { get; init; }
    public required Guid TokenId { get; init; }
}
