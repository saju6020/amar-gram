using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Inventory;

/// <summary>HO-P4 BG-18 -- <see cref="IGoodsReceiptDraftCounter"/> over <c>inventory.goods_receipt_draft</c>: the owner's drafts that are neither discarded nor posted.</summary>
public sealed class EfGoodsReceiptDraftCounter(AmarGramDbContext db) : IGoodsReceiptDraftCounter
{
    public Task<int> CountOpenAsync(Guid ownerId, CancellationToken ct) =>
        db.GoodsReceiptDrafts.AsNoTracking().CountAsync(d => d.OwnerId == ownerId && d.DiscardedOn == null && d.PostedGoodsReceiptId == null, ct);
}
