using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Product;

/// <summary>HO-P4 BG-10 -- the two bulk actions. <c>Publish</c> is the single-product publish (Draft or Archived to Active, with the full
/// publication checklist); <c>Unpublish</c> ("hide") is the single-product unpublish (Active back to Draft: the product leaves the storefront
/// but keeps its content, prices and stock, and can be published again). "Hide" is deliberately NOT the <c>ListedOnStorefront</c> flag: that is a
/// field of the product's details form, not a lifecycle transition, and has no command of its own.</summary>
public static class BulkProductActions
{
    public const string Publish = "Publish";
    public const string Unpublish = "Unpublish";

    public static readonly IReadOnlyList<string> All = [Publish, Unpublish];
}

/// <summary>HO-P4 BG-10 -- publish or hide several products at once. Each product is its own transaction (one aggregate per command);
/// the result reports every product's outcome. The request carries NO versions: the safer design here, because a list row's version is
/// stale the moment someone else edits, and the transition is itself state-guarded (Publish needs Draft/Archived and a complete checklist,
/// Unpublish needs Active), so applying it to the product's current state cannot do anything the staff member did not intend.</summary>
public sealed class BulkChangeProductStatusCommand : Command
{
    public required IReadOnlyList<Guid> ProductIds { get; init; }
    public required string Action { get; init; }
}

/// <summary>One product's outcome. <c>Status</c> is the product's status after the attempt (unchanged on failure is not known to this
/// handler, so it is null then); <c>ErrorCode</c>/<c>Message</c> carry the violation exactly as the single-product endpoint would return it.</summary>
public sealed record BulkProductStatusItem(Guid ProductId, bool Succeeded, string? Status, string? ErrorCode, string? PropertyName, string? Message);

public sealed record BulkProductStatusResult(string Action, int SucceededCount, int FailedCount, IReadOnlyList<BulkProductStatusItem> Items);
