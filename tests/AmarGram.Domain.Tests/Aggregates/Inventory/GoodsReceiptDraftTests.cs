using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.Tests.Aggregates.Inventory;

/// <summary>HO-P4 BG-18 -- a goods-receipt draft is the owner's lenient workspace: saved over and over, closed by discard or posting, never revived.</summary>
public sealed class GoodsReceiptDraftTests
{
    private static readonly Guid Owner = Guid.NewGuid();
    private static readonly Guid Branch = Guid.NewGuid();

    private static GoodsReceiptDraftLineDto Line(Guid? skuId = null, decimal accepted = 5m, string? lot = null) =>
        new(skuId ?? Guid.NewGuid(), null, lot, null, null, accepted, 0m, null, null, null, false, null, null, null);

    private static GoodsReceiptDraftSaveDto Dto(Guid? owner = null, params GoodsReceiptDraftLineDto[] lines) =>
        new(owner ?? Owner, Branch, null, null, null, "  DN-1  ", null, null, lines, TestUserContext.Create(), Guid.NewGuid());

    [Fact]
    public void Save_CreatesAnOpenDraftOwnedByTheCaller_WithoutRaisingEvents()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());

        draft.Save(Dto(null, Line(), Line()));

        Assert.True(draft.IsOpen);
        Assert.Equal(Owner, draft.OwnerId);
        Assert.Equal(Branch, draft.BranchId);
        Assert.Equal("DN-1", draft.DeliveryReference);
        Assert.Equal(2, draft.Lines.Count);
        Assert.Empty(draft.Events);
        Assert.Equal(1, draft.Version);
    }

    [Fact]
    public void Save_AHalfFilledFormIsAValidDraft_NoLotNoLocationNoExpiry()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto(null, Line(accepted: 0m)));
        Assert.Null(draft.Lines.Single().LotNumber);
        Assert.Null(draft.Lines.Single().LocationId);
    }

    [Fact]
    public void Save_AgainReplacesTheWholeContent_AndKeepsTheOwner()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto(null, Line(), Line(), Line()));

        draft.Save(Dto(null, Line()));

        Assert.Single(draft.Lines);
        Assert.Equal(2, draft.Version);
    }

    [Fact]
    public void Save_ByAnotherStaffMember_IsRefusedAsNotFound()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto());

        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto(Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.GoodsReceiptDraftNotFound, ex.ErrorCode);
    }

    [Fact]
    public void Save_AfterDiscard_IsRefused_ALateAutosaveCannotRevive()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto(null, Line()));
        draft.Discard(Owner, DateTimeOffset.UtcNow);

        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto(null, Line())));
        Assert.Equal(BusinessViolationCodes.GoodsReceiptDraftNotFound, ex.ErrorCode);
    }

    [Fact]
    public void Discard_ClearsTheContent_AndIsIdempotent()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto(null, Line()));

        draft.Discard(Owner, DateTimeOffset.UtcNow);
        var version = draft.Version;
        draft.Discard(Owner, DateTimeOffset.UtcNow);

        Assert.False(draft.IsOpen);
        Assert.Empty(draft.Lines);
        Assert.Null(draft.DeliveryReference);
        Assert.NotNull(draft.DiscardedOn);
        Assert.Equal(version, draft.Version);
    }

    [Fact]
    public void Discard_ByAnotherStaffMember_IsRefusedAsNotFound()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto());

        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Discard(Guid.NewGuid(), DateTimeOffset.UtcNow));
        Assert.Equal(BusinessViolationCodes.GoodsReceiptDraftNotFound, ex.ErrorCode);
        Assert.True(draft.IsOpen);
    }

    [Fact]
    public void MarkPosted_ClosesTheDraftAndRemembersTheReceipt_OnlyForTheOwner()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        draft.Save(Dto(null, Line()));
        var receiptId = Guid.NewGuid();

        draft.MarkPosted(Guid.NewGuid(), receiptId);
        Assert.True(draft.IsOpen);

        draft.MarkPosted(Owner, receiptId);
        Assert.False(draft.IsOpen);
        Assert.Equal(receiptId, draft.PostedGoodsReceiptId);
        Assert.Empty(draft.Lines);

        Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto()));
    }

    [Fact]
    public void Save_TooManyLines_IsInvalid()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        var lines = Enumerable.Range(0, InventoryRules.MaxReceiptLines + 1).Select(_ => Line()).ToArray();

        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto(null, lines)));
        Assert.Equal(BusinessViolationCodes.InvalidGoodsReceiptDraft, ex.ErrorCode);
    }

    [Fact]
    public void Save_ALineWithoutAnItem_IsInvalid_NamingTheLine()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto(null, Line(), Line(Guid.Empty))));
        Assert.Equal(BusinessViolationCodes.InvalidGoodsReceiptDraft, ex.ErrorCode);
        Assert.Equal("Lines[1].SkuId", ex.PropertyName);
    }

    [Fact]
    public void Save_ANegativeQuantity_IsInvalid()
    {
        var draft = new GoodsReceiptDraftAggregate(Guid.NewGuid());
        var ex = Assert.Throws<DomainRuleViolationException>(() => draft.Save(Dto(null, Line(accepted: -1m))));
        Assert.Equal(BusinessViolationCodes.InvalidGoodsReceiptDraft, ex.ErrorCode);
    }
}
