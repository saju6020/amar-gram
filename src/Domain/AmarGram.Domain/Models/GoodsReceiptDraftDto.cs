using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-P4 BG-18 -- one draft line as the staff member typed it.</summary>
public sealed record GoodsReceiptDraftLineDto(
    Guid SkuId, Guid? PurchaseOrderLineId, string? LotNumber, DateOnly? ManufacturedOn, DateOnly? ExpiresOn, decimal QuantityAccepted, decimal QuantityRejected,
    string? RejectionReason, string? RejectionNote, Guid? LocationId, bool HoldForInspection, decimal? UnitCostAmount, string? UnitCostCurrency, decimal? ExchangeRateToBase);

/// <summary>HO-P4 BG-18 -- the whole form, saved as one replace (autosave sends the form as it stands).</summary>
public sealed record GoodsReceiptDraftSaveDto(
    Guid OwnerId, Guid BranchId, Guid? SupplierId, Guid? PurchaseOrderId, Guid? ConsignmentId, string? DeliveryReference, DateOnly? ReceivedOn, string? Note,
    IReadOnlyList<GoodsReceiptDraftLineDto> Lines, UserContext UserContext, Guid CorrelationId);
