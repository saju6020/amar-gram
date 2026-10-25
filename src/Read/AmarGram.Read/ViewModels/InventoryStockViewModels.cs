namespace AmarGram.Read.ViewModels;

// HO-IMP-001 §12.4 -- goods receipts, stock, batches and the ledger. Quantities are strings with the stock unit beside them; every batch view
// carries isExpired, daysToExpiry and branchTimeZoneId (expiry is DERIVED in the branch's local date, never stored -- ADR-101); every SKU,
// receipt, batch and stock read carries `storage` (US-IMP-16 AC1). The ledger view has NO customer field -- that is in the recall
// trace only (ADR-104).

public sealed record GoodsReceiptSummaryViewModel(
    Guid Id, string Number, DateTimeOffset ReceivedOn, Guid? SupplierId, string? SupplierName, Guid? PurchaseOrderId, string? PurchaseOrderNumber,
    Guid? ConsignmentId, string? DeliveryReference, int LineCount, int BatchCount, Guid ReceivedBy);

public sealed record GoodsReceiptLineViewModel(
    Guid LineId, Guid SkuId, string SkuCode, string DisplayName, string StockUnit, string LotNumber, DateOnly? ManufacturedOn, DateOnly? ExpiresOn,
    string QuantityAccepted, string QuantityRejected, string? RejectionReason, string? RejectionNote, Guid LocationId, string? LocationCode, bool HoldForInspection,
    MoneyViewModel? UnitCost, Guid? BatchId, string? BatchStatus, StorageViewModel? Storage);

public sealed record GoodsReceiptDetailViewModel(
    Guid Id, string Number, Guid BranchId, DateTimeOffset ReceivedOn, Guid ReceivedBy, Guid? SupplierId, string? SupplierName, Guid? PurchaseOrderId,
    string? PurchaseOrderNumber, Guid? ConsignmentId, string? ConsignmentReference, string? DeliveryReference, IReadOnlyList<GoodsReceiptLineViewModel> Lines);

/// <summary>One SKU's stock across the branch, partitioned so the buckets never overlap: <c>HeldQuantity</c> (a quarantined or recalled batch, or
/// anything at a quarantine location), <c>ExpiredQuantity</c> (derived), and the rest, of which <c>Usable</c> is on-hand minus reserved and
/// <c>Sellable</c> is the usable quantity at retail-selling locations (what the storefront may offer).
/// HO-P4 BG-16: <c>ReorderLevel</c> is the SKU's reorder point in this branch (a quantity string) -- the sum of its explicit per-location reorder
/// policies, else the branch default once (<c>ReorderLevelIsDefault</c> true); "0" when reordering is switched off for it. <c>BelowReorderLevel</c> is
/// exactly the <c>belowReorderPoint</c> filter's rule: some (SKU, location) pair has a point above 0 and less usable stock than it.</summary>
public sealed record StockSummaryViewModel(
    Guid SkuId, string SkuCode, string DisplayName, string StockUnit, string StockClass, string OnHand, string Reserved, string Usable, string Sellable,
    string ExpiredQuantity, string HeldQuantity, DateOnly? NextExpiresOn, StorageViewModel? Storage,
    string ReorderLevel = "0", bool ReorderLevelIsDefault = true, bool BelowReorderLevel = false);

/// <summary>HO-P4 BG-18 -- one row of the caller's draft list. <c>UpdatedOn</c> is when it was last autosaved.</summary>
public sealed record GoodsReceiptDraftSummaryViewModel(
    Guid DraftId, Guid BranchId, string? BranchName, Guid? SupplierId, string? SupplierName, Guid? PurchaseOrderId, Guid? ConsignmentId, string? DeliveryReference,
    int LineCount, int Version, DateTimeOffset UpdatedOn);

public sealed record GoodsReceiptDraftLineViewModel(
    Guid SkuId, string? SkuCode, string? DisplayName, Guid? PurchaseOrderLineId, string? LotNumber, DateOnly? ManufacturedOn, DateOnly? ExpiresOn,
    string QuantityAccepted, string QuantityRejected, string? RejectionReason, string? RejectionNote, Guid? LocationId, bool HoldForInspection,
    string? UnitCostAmount, string? UnitCostCurrency, string? ExchangeRateToBase);

/// <summary>HO-P4 BG-18 -- a draft in full, exactly as it was saved (lines in the order typed). Costs are only read back to the person who typed them.</summary>
public sealed record GoodsReceiptDraftViewModel(
    Guid DraftId, Guid BranchId, string? BranchName, Guid? SupplierId, Guid? PurchaseOrderId, Guid? ConsignmentId, string? DeliveryReference, DateOnly? ReceivedOn,
    string? Note, int Version, DateTimeOffset UpdatedOn, IReadOnlyList<GoodsReceiptDraftLineViewModel> Lines);

public sealed record StockLocationQuantityViewModel(Guid LocationId, string LocationCode, string LocationKind, string OnHand, string Reserved);

/// <summary>HO-P4 BG-16: <c>ReceivedOn</c> is when the batch was received and <c>SupplierId</c>/<c>SupplierName</c> who supplied it (null when the receipt named no supplier).</summary>
public sealed record StockMatrixBatchViewModel(
    Guid BatchId, string LotNumber, DateOnly? ExpiresOn, bool IsExpired, int? DaysToExpiry, string Status, IReadOnlyList<StockLocationQuantityViewModel> Locations,
    DateTimeOffset? ReceivedOn = null, Guid? SupplierId = null, string? SupplierName = null);

/// <summary>US-IMP-06 -- the batch x location matrix of one SKU.</summary>
public sealed record SkuStockMatrixViewModel(
    Guid SkuId, string SkuCode, string DisplayName, string StockUnit, StorageViewModel? Storage, string BranchTimeZoneId, IReadOnlyList<StockMatrixBatchViewModel> Batches);

public sealed record BatchSummaryViewModel(
    Guid Id, Guid SkuId, string SkuCode, string DisplayName, string LotNumber, DateOnly? ExpiresOn, bool IsExpired, int? DaysToExpiry, string BranchTimeZoneId,
    string Status, string ReceivedQuantity, string OnHand, string StockUnit, Guid? ConsignmentId);

public sealed record BatchPositionViewModel(Guid LocationId, string LocationCode, string LocationKind, string OnHand, string Reserved);

public sealed record BatchStatusChangeViewModel(string From, string To, string? Reason, DateTimeOffset ChangedOn, Guid ChangedBy);

public sealed record BatchRecallViewModel(
    string RecallNumber, string Reason, string CustomerAdvice, DateTimeOffset DeclaredOn, Guid DeclaredBy, DateTimeOffset? NotifiedOn, Guid? NotifiedBy,
    int NotifiedRecipientCount, int NotificationRuns, DateTimeOffset? ClosedOn, string? ClosingNote);

/// <summary><c>UnitCostBase</c>, <c>CostBasis</c> and <c>PurchaseUnitCost</c> are null for a caller without <c>InventoryReports.View</c>.</summary>
public sealed record BatchDetailViewModel(
    Guid Id, Guid SkuId, string SkuCode, string DisplayName, string StockUnit, string StockClass, Guid BranchId, string LotNumber, DateOnly? ManufacturedOn,
    DateOnly? ExpiresOn, bool IsExpired, int? DaysToExpiry, string BranchTimeZoneId, string Status, string? StatusReason, DateTimeOffset ReceivedOn,
    string ReceivedQuantity, Guid GoodsReceiptId, string? GoodsReceiptNumber, Guid? ConsignmentId, string? ConsignmentReference, Guid? SupplierId, string? OriginCountryCode,
    MoneyViewModel? PurchaseUnitCost, MoneyViewModel? UnitCostBase, string? CostBasis, IReadOnlyList<BatchPositionViewModel> Positions, BatchRecallViewModel? Recall,
    IReadOnlyList<BatchStatusChangeViewModel> StatusHistory, IReadOnlyList<string> AllowedActions, StorageViewModel? Storage, int Version);

public sealed record LedgerEntryViewModel(
    long Sequence, DateTimeOffset OccurredOn, string Kind, string QuantityDelta, string StockUnit, Guid LocationId, string? LocationCode, Guid BatchId, string? LotNumber,
    Guid SkuId, string? SkuCode, string ReferenceKind, Guid ReferenceId, string? ReferenceLabel, bool FefoOverridden, string? OverrideReason, Guid PerformedBy,
    string? PerformedByName, string? Note);
