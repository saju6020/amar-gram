using AmarGram.Application.Commands.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Api.Contracts.Inventory;

/// <summary>HO-IMP-001 §12.4 request bodies -- goods receipts and batch status. Every line id and batch id is minted in the controller (§11.1).</summary>
public sealed class GoodsReceiptLineRequest
{
    public required Guid SkuId { get; init; }
    public Guid? PurchaseOrderLineId { get; init; }
    public string LotNumber { get; init; } = string.Empty;
    public DateOnly? ManufacturedOn { get; init; }
    public DateOnly? ExpiresOn { get; init; }
    public decimal QuantityAccepted { get; init; }
    public decimal QuantityRejected { get; init; }
    public string? RejectionReason { get; init; }
    public string? RejectionNote { get; init; }
    public required Guid LocationId { get; init; }
    public bool HoldForInspection { get; init; }
    public decimal? UnitCostAmount { get; init; }
    public string? UnitCostCurrency { get; init; }
    public decimal? ExchangeRateToBase { get; init; }
}

public sealed class PostGoodsReceiptRequest
{
    /// <summary>HO-P4 BG-18 -- the branch to receive into, when it is not the active one. The caller must be assigned to it (403 <c>BranchNotAssigned</c> otherwise); the
    /// purchase order, consignment and every line location are then checked against THIS branch.</summary>
    public Guid? BranchId { get; init; }

    /// <summary>HO-P4 BG-18 -- the caller's own draft this receipt was filled in from; closed once the receipt is posted.</summary>
    public Guid? DraftId { get; init; }

    public Guid? SupplierId { get; init; }
    public Guid? PurchaseOrderId { get; init; }
    public Guid? ConsignmentId { get; init; }
    public string? DeliveryReference { get; init; }
    public required IReadOnlyList<GoodsReceiptLineRequest> Lines { get; init; }

    public IReadOnlyList<GoodsReceiptLineInput> ToLines() => Lines.Select(l => new GoodsReceiptLineInput(
        Guid.NewGuid(), l.SkuId, l.PurchaseOrderLineId, l.LotNumber ?? string.Empty, l.ManufacturedOn, l.ExpiresOn, l.QuantityAccepted, l.QuantityRejected,
        l.RejectionReason, l.RejectionNote, l.LocationId, l.HoldForInspection, l.UnitCostAmount, l.UnitCostCurrency, l.ExchangeRateToBase, Guid.NewGuid())).ToList();
}

/// <summary>HO-P4 BG-18 -- the receiving form as it stands. Every field is optional except each line's item; nothing is checked against the stock rules until posting.</summary>
public sealed class SaveGoodsReceiptDraftRequest
{
    /// <summary>The branch being received into; omit for the active branch.</summary>
    public Guid? BranchId { get; init; }
    public Guid? SupplierId { get; init; }
    public Guid? PurchaseOrderId { get; init; }
    public Guid? ConsignmentId { get; init; }
    public string? DeliveryReference { get; init; }
    public DateOnly? ReceivedOn { get; init; }
    public string? Note { get; init; }
    public IReadOnlyList<GoodsReceiptDraftLineRequest> Lines { get; init; } = [];

    public IReadOnlyList<GoodsReceiptDraftLineInput> ToLines() => Lines.Select(l => new GoodsReceiptDraftLineInput(
        l.SkuId, l.PurchaseOrderLineId, l.LotNumber, l.ManufacturedOn, l.ExpiresOn, l.QuantityAccepted, l.QuantityRejected, l.RejectionReason, l.RejectionNote,
        l.LocationId, l.HoldForInspection, l.UnitCostAmount, l.UnitCostCurrency, l.ExchangeRateToBase)).ToList();
}

public sealed class GoodsReceiptDraftLineRequest
{
    public required Guid SkuId { get; init; }
    public Guid? PurchaseOrderLineId { get; init; }
    public string? LotNumber { get; init; }
    public DateOnly? ManufacturedOn { get; init; }
    public DateOnly? ExpiresOn { get; init; }
    public decimal QuantityAccepted { get; init; }
    public decimal QuantityRejected { get; init; }
    public string? RejectionReason { get; init; }
    public string? RejectionNote { get; init; }
    public Guid? LocationId { get; init; }
    public bool HoldForInspection { get; init; }
    public decimal? UnitCostAmount { get; init; }
    public string? UnitCostCurrency { get; init; }
    public decimal? ExchangeRateToBase { get; init; }
}

public sealed class BatchReasonRequest
{
    public required string Reason { get; init; }
}

/// <summary>Whether the caller may see costs: holds <c>InventoryReports.View</c> (stock valuation is the accountant's and manager's, not reception's).</summary>
public static class InventoryCaller
{
    public static bool Can(this UserContext user, string action) =>
        ActionRoles.TryGetRoles(action, out var roles) && roles.Intersect(user.Roles ?? [], StringComparer.Ordinal).Any();
}

public sealed class StockTransferLineRequest
{
    public required Guid SkuId { get; init; }
    public required Guid BatchId { get; init; }
    public required decimal Quantity { get; init; }
}

public sealed class PostStockTransferRequest
{
    public required Guid FromLocationId { get; init; }
    public required Guid ToLocationId { get; init; }
    public string? Reason { get; init; }
    public required IReadOnlyList<StockTransferLineRequest> Lines { get; init; }

    public IReadOnlyList<StockTransferLineInput> ToLines() =>
        Lines.Select(l => new StockTransferLineInput(Guid.NewGuid(), l.SkuId, l.BatchId, l.Quantity)).ToList();
}

public sealed class AdjustmentLineRequest
{
    public required Guid SkuId { get; init; }
    public required Guid BatchId { get; init; }
    public required decimal QuantityDelta { get; init; }
}

public sealed class RequestStockAdjustmentRequest
{
    public required Guid LocationId { get; init; }
    public string? Reason { get; init; }
    public string? Note { get; init; }
    public required IReadOnlyList<AdjustmentLineRequest> Lines { get; init; }

    public IReadOnlyList<AdjustmentLineInput> ToLines() =>
        Lines.Select(l => new AdjustmentLineInput(Guid.NewGuid(), l.SkuId, l.BatchId, l.QuantityDelta)).ToList();
}

public sealed class DecideStockAdjustmentRequest
{
    public string? Note { get; init; }
}

public sealed class OpenStockCountRequest
{
    public required Guid LocationId { get; init; }
    public required string Scope { get; init; }
    public IReadOnlyList<Guid> SkuIds { get; init; } = [];
}

public sealed class RecordCountLinesRequest
{
    public required IReadOnlyList<CountLineInput> Lines { get; init; }
}

public sealed class AllocateLandedCostRequest
{
    public required int ExpectedVersion { get; init; }
}

public sealed class AcknowledgeStockAlertRequest
{
    public string? Note { get; init; }
}

public sealed class SetReorderPolicyRequest
{
    public required decimal ReorderPoint { get; init; }
    public decimal? ReorderQuantity { get; init; }
    public Guid? PreferredSupplierId { get; init; }
}

public sealed class RecallBatchRequest
{
    public string? ConfirmLotNumber { get; init; }
    public string? Reason { get; init; }
    public string? CustomerAdvice { get; init; }
}

public sealed class RecallBatchReasonRequest
{
    public string? Reason { get; init; }
}

public sealed class RecallClosureRequest
{
    public string? Note { get; init; }
}

public sealed class ReportStorageBreachRequest
{
    public required Guid LocationId { get; init; }
    public DateTimeOffset? ObservedOn { get; init; }
    public string? Condition { get; init; }
    public decimal? TemperatureC { get; init; }
    public int? DurationMinutes { get; init; }
}

public sealed class CloseStorageBreachRequest
{
    public string? Note { get; init; }
}
