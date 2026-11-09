using AmarGram.Domain.Entities;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Inventory;

/// <summary>
/// HO-P4 BG-18 -- a server-side goods-receipt draft: the receiving form as a staff member left it, so it survives a closed tab, a dropped
/// connection or a change of device. A draft is the OWNER's workspace, not a business record: it carries no stock, raises no domain event
/// (an autosave every few seconds must not flood the event bus or the audit trail) and is never read by another staff member. Posting still
/// goes through <c>PostGoodsReceiptCommand</c>, whose rules are not applied here -- a half-filled form is a valid draft; only shape limits are.
///
/// Lifecycle: Open (saved over and over) to Discarded (the owner threw it away) or Posted (a receipt was posted from it). The platform
/// repository has no delete, so a closed draft keeps a tombstone row with its content cleared; a closed draft can never be saved again,
/// so a late autosave from an old tab cannot bring a discarded or posted draft back.
/// </summary>
public sealed class GoodsReceiptDraftAggregate : AggregateRoot
{
    private readonly List<GoodsReceiptDraftLine> _lines = [];

    public Guid OwnerId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? SupplierId { get; private set; }
    public Guid? PurchaseOrderId { get; private set; }
    public Guid? ConsignmentId { get; private set; }
    public string? DeliveryReference { get; private set; }
    public DateOnly? ReceivedOn { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset? DiscardedOn { get; private set; }
    public Guid? PostedGoodsReceiptId { get; private set; }
    public IReadOnlyList<GoodsReceiptDraftLine> Lines => _lines;

    public bool IsOpen => DiscardedOn is null && PostedGoodsReceiptId is null;

    private GoodsReceiptDraftAggregate() { }

    public GoodsReceiptDraftAggregate(Guid id) : base(id) { }

    /// <summary>Creates the draft on the first save and replaces its content on every later one. The owner never changes.</summary>
    public void Save(GoodsReceiptDraftSaveDto dto)
    {
        if (OwnerId != Guid.Empty && OwnerId != dto.OwnerId)
            throw InventoryViolation.Of(BusinessViolationCodes.GoodsReceiptDraftNotFound, "That draft was not found.", nameof(Id));
        if (!IsOpen)
            throw InventoryViolation.Of(BusinessViolationCodes.GoodsReceiptDraftNotFound, "That draft was closed and can no longer be saved. Start a new one.", nameof(Id));

        Validate(dto);

        var isNew = OwnerId == Guid.Empty;
        OwnerId = dto.OwnerId;
        BranchId = dto.BranchId;
        SupplierId = dto.SupplierId;
        PurchaseOrderId = dto.PurchaseOrderId;
        ConsignmentId = dto.ConsignmentId;
        DeliveryReference = Clean(dto.DeliveryReference);
        ReceivedOn = dto.ReceivedOn;
        Note = Clean(dto.Note);

        _lines.Clear();
        _lines.AddRange(dto.Lines.Select((l, index) => new GoodsReceiptDraftLine(
            Guid.NewGuid(), l.SkuId, l.PurchaseOrderLineId, l.LotNumber, l.ManufacturedOn, l.ExpiresOn, l.QuantityAccepted, l.QuantityRejected, l.RejectionReason,
            l.RejectionNote, l.LocationId, l.HoldForInspection, l.UnitCostAmount, l.UnitCostCurrency, l.ExchangeRateToBase, index)));

        if (isNew) SetDefaultValue(dto.UserContext);
        UpdateVersion();
    }

    /// <summary>The owner throws the draft away; the content is cleared. Discarding an already-closed draft is not an error (idempotent).</summary>
    public void Discard(Guid ownerId, DateTimeOffset now)
    {
        if (OwnerId != ownerId)
            throw InventoryViolation.Of(BusinessViolationCodes.GoodsReceiptDraftNotFound, "That draft was not found.", nameof(Id));
        if (!IsOpen) return;

        DiscardedOn = now;
        Clear();
        UpdateVersion();
    }

    /// <summary>A receipt was posted from this draft; the content is cleared. A no-op for a draft that is not open.</summary>
    public void MarkPosted(Guid ownerId, Guid goodsReceiptId)
    {
        if (OwnerId != ownerId || !IsOpen) return;

        PostedGoodsReceiptId = goodsReceiptId;
        Clear();
        UpdateVersion();
    }

    private void Clear()
    {
        _lines.Clear();
        SupplierId = null;
        PurchaseOrderId = null;
        ConsignmentId = null;
        DeliveryReference = null;
        ReceivedOn = null;
        Note = null;
    }

    private static void Validate(GoodsReceiptDraftSaveDto dto)
    {
        if (dto.Lines.Count > InventoryRules.MaxReceiptLines)
            throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, $"A receipt has at most {InventoryRules.MaxReceiptLines} lines.", nameof(dto.Lines));
        if (Clean(dto.DeliveryReference) is { Length: > 60 })
            throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, "The delivery reference is at most 60 characters.", nameof(dto.DeliveryReference));
        if (Clean(dto.Note) is { Length: > InventoryRules.MaxDraftNoteLength })
            throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, $"The note is at most {InventoryRules.MaxDraftNoteLength} characters.", nameof(dto.Note));

        for (var i = 0; i < dto.Lines.Count; i++)
        {
            var line = dto.Lines[i];
            var prefix = $"Lines[{i}]";
            if (line.SkuId == Guid.Empty)
                throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, "Every line needs an item.", $"{prefix}.SkuId");
            if (line.QuantityAccepted < 0m || line.QuantityRejected < 0m || line.QuantityAccepted > 999_999_999m || line.QuantityRejected > 999_999_999m)
                throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, "Quantities cannot be negative.", $"{prefix}.QuantityAccepted");
            if (line.LotNumber is { Length: > InventoryRules.MaxLotNumberLength })
                throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, $"The lot number is at most {InventoryRules.MaxLotNumberLength} characters.", $"{prefix}.LotNumber");
            if (line.RejectionNote is { Length: > InventoryRules.NoteMaxLength } || line.RejectionReason is { Length: > 40 })
                throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, "The rejection note is too long.", $"{prefix}.RejectionNote");
            if (line.UnitCostAmount is < 0m or > 9_999_999_999m || line.ExchangeRateToBase is < 0m or > 999_999_999_999m || line.UnitCostCurrency is { Length: > 3 })
                throw InventoryViolation.Of(BusinessViolationCodes.InvalidGoodsReceiptDraft, "The unit cost or exchange rate is out of range.", $"{prefix}.UnitCostAmount");
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
