namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// Owned by HO-IMP-001 §8.8/§10.1 (ADR-103/ADR-104). What document a stock movement traces back to
/// -- the reference the recall trace reads. Consumers' kinds are **pre-declared here by the owner**
/// so a consuming handover never edits this file (HO-IMP-001 §10.1's own words).
/// </summary>
public sealed class StockReferenceKind(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly StockReferenceKind GoodsReceipt = new(1, nameof(GoodsReceipt));
    public static readonly StockReferenceKind StockTransfer = new(2, nameof(StockTransfer));
    public static readonly StockReferenceKind StockAdjustment = new(3, nameof(StockAdjustment));
    public static readonly StockReferenceKind StockCount = new(4, nameof(StockCount));
    public static readonly StockReferenceKind BatchWriteOff = new(5, nameof(BatchWriteOff));
    public static readonly StockReferenceKind StorageBreach = new(6, nameof(StorageBreach));
    public static readonly StockReferenceKind CustomerOrder = new(7, nameof(CustomerOrder));
    public static readonly StockReferenceKind PosSale = new(8, nameof(PosSale));
    public static readonly StockReferenceKind CustomerReturn = new(13, nameof(CustomerReturn));

}
