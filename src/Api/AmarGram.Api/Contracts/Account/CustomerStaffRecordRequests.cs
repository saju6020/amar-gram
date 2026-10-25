namespace AmarGram.Api.Contracts.Account;

/// <summary>HO-P4 BG-19 -- <c>POST /api/staff/customers/{customerId}/notes</c>.</summary>
public sealed class AddCustomerNoteRequest
{
    public string Text { get; init; } = default!;
}

/// <summary>HO-P4 BG-19 -- <c>PUT /api/staff/customers/{customerId}/tags</c>: the whole tag set.</summary>
public sealed class SetCustomerTagsRequest
{
    public IReadOnlyList<string> Tags { get; init; } = [];
}
