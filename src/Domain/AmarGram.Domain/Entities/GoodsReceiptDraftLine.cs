namespace AmarGram.Domain.Entities;

/// <summary>HO-P4 BG-18 -- one line of a goods-receipt draft, owned by <c>GoodsReceiptDraftAggregate</c>. It mirrors a receipt line but is
/// deliberately lenient (a half-filled form is a valid draft): only the SKU is required; the posting rules (lot, expiry, location, costs) are
/// applied when the receipt is posted, never when a draft is saved.</summary>
public sealed class GoodsReceiptDraftLine
{
    public Guid Id { get; private set; }
    public Guid SkuId { get; private set; }
    public Guid? PurchaseOrderLineId { get; private set; }
    public string? LotNumber { get; private set; }
    public DateOnly? ManufacturedOn { get; private set; }
    public DateOnly? ExpiresOn { get; private set; }
    public decimal QuantityAccepted { get; private set; }
    public decimal QuantityRejected { get; private set; }
    public string? RejectionReason { get; private set; }
    public string? RejectionNote { get; private set; }
    public Guid? LocationId { get; private set; }
    public bool HoldForInspection { get; private set; }
    public decimal? UnitCostAmount { get; private set; }
    public string? UnitCostCurrency { get; private set; }
    public decimal? ExchangeRateToBase { get; private set; }
    public int SortOrder { get; private set; }

    private GoodsReceiptDraftLine() { }

    public GoodsReceiptDraftLine(
        Guid id, Guid skuId, Guid? purchaseOrderLineId, string? lotNumber, DateOnly? manufacturedOn, DateOnly? expiresOn, decimal quantityAccepted,
        decimal quantityRejected, string? rejectionReason, string? rejectionNote, Guid? locationId, bool holdForInspection, decimal? unitCostAmount,
        string? unitCostCurrency, decimal? exchangeRateToBase, int sortOrder)
    {
        Id = id;
        SkuId = skuId;
        PurchaseOrderLineId = purchaseOrderLineId;
        LotNumber = string.IsNullOrWhiteSpace(lotNumber) ? null : lotNumber.Trim();
        ManufacturedOn = manufacturedOn;
        ExpiresOn = expiresOn;
        QuantityAccepted = quantityAccepted;
        QuantityRejected = quantityRejected;
        RejectionReason = string.IsNullOrWhiteSpace(rejectionReason) ? null : rejectionReason.Trim();
        RejectionNote = string.IsNullOrWhiteSpace(rejectionNote) ? null : rejectionNote.Trim();
        LocationId = locationId;
        HoldForInspection = holdForInspection;
        UnitCostAmount = unitCostAmount;
        UnitCostCurrency = string.IsNullOrWhiteSpace(unitCostCurrency) ? null : unitCostCurrency.Trim().ToUpperInvariant();
        ExchangeRateToBase = exchangeRateToBase;
        SortOrder = sortOrder;
    }
}
