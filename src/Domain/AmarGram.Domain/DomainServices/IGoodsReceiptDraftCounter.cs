namespace AmarGram.Domain.DomainServices;

/// <summary>HO-P4 BG-18 -- how many goods-receipt drafts a staff member currently has open (the platform repository can only fetch by id or
/// filter, not count). Used to enforce <c>InventoryRules.MaxGoodsReceiptDraftsPerStaff</c> when a NEW draft is first saved.</summary>
public interface IGoodsReceiptDraftCounter
{
    Task<int> CountOpenAsync(Guid ownerId, CancellationToken ct);
}
