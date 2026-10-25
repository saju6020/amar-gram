using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Inventory;

// HO-P4 BG-18 -- server-side goods-receipt drafts. Both are the caller's OWN drafts (the owner is the command's UserContext.UserId).

/// <summary>One draft line, as typed -- lenient (see <c>GoodsReceiptDraftLine</c>).</summary>
public sealed record GoodsReceiptDraftLineInput(
    Guid SkuId, Guid? PurchaseOrderLineId, string? LotNumber, DateOnly? ManufacturedOn, DateOnly? ExpiresOn, decimal QuantityAccepted, decimal QuantityRejected,
    string? RejectionReason, string? RejectionNote, Guid? LocationId, bool HoldForInspection, decimal? UnitCostAmount, string? UnitCostCurrency, decimal? ExchangeRateToBase);

/// <summary>Creates the draft with the client-minted <see cref="DraftId"/>, or replaces its content (idempotent -- the autosave).
/// <c>Stock.Receive</c>.</summary>
public sealed class SaveGoodsReceiptDraftCommand : Command
{
    public required Guid DraftId { get; init; }
    public required Guid BranchId { get; init; }
    public Guid? SupplierId { get; init; }
    public Guid? PurchaseOrderId { get; init; }
    public Guid? ConsignmentId { get; init; }
    public string? DeliveryReference { get; init; }
    public DateOnly? ReceivedOn { get; init; }
    public string? Note { get; init; }
    public required IReadOnlyList<GoodsReceiptDraftLineInput> Lines { get; init; }
}

/// <summary>Throws the draft away. Discarding a draft that is already closed succeeds. <c>Stock.Receive</c>.</summary>
public sealed class DiscardGoodsReceiptDraftCommand : Command
{
    public required Guid DraftId { get; init; }
}
