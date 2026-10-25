using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Infrastructure.Inventory;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AmarGram.Infrastructure.Persistence.Configurations;

/// <summary>HO-P4 BG-18 -- <c>inventory.goods_receipt_draft</c> and its lines. A draft is read by its owner only, newest first
/// (<c>ix_goods_receipt_draft_owner</c>). No foreign keys to suppliers, orders, consignments, SKUs or locations: a draft may hold a half-chosen
/// form, and posting validates every reference.</summary>
public sealed class GoodsReceiptDraftConfiguration : IEntityTypeConfiguration<GoodsReceiptDraftAggregate>
{
    public void Configure(EntityTypeBuilder<GoodsReceiptDraftAggregate> builder)
    {
        builder.ConfigureInventoryRoot("goods_receipt_draft");

        builder.Property(x => x.OwnerId).HasColumnName("owner_id").IsRequired();
        builder.Property(x => x.BranchId).HasColumnName("branch_id").IsRequired();
        builder.Property(x => x.SupplierId).HasColumnName("supplier_id");
        builder.Property(x => x.PurchaseOrderId).HasColumnName("purchase_order_id");
        builder.Property(x => x.ConsignmentId).HasColumnName("consignment_id");
        builder.Property(x => x.DeliveryReference).HasColumnName("delivery_reference").HasMaxLength(60);
        builder.Property(x => x.ReceivedOn).HasColumnName("received_on").HasColumnType("date");
        builder.Property(x => x.Note).HasColumnName("note").HasMaxLength(InventoryRules.MaxDraftNoteLength);
        builder.Property(x => x.DiscardedOn).HasColumnName("discarded_on").HasColumnType("timestamptz");
        builder.Property(x => x.PostedGoodsReceiptId).HasColumnName("posted_goods_receipt_id");

        builder.HasIndex(x => new { x.OwnerId, x.DiscardedOn, x.PostedGoodsReceiptId }).HasDatabaseName("ix_goods_receipt_draft_owner");

        builder.OwnsMany(x => x.Lines, line =>
        {
            line.ToTable("goods_receipt_draft_line", InventoryMapping.Schema);
            line.WithOwner().HasForeignKey("goods_receipt_draft_id");
            line.HasKey("Id");
            line.Property(l => l.Id).ValueGeneratedNever();

            line.Property(l => l.SkuId).HasColumnName("sku_id").IsRequired();
            line.Property(l => l.PurchaseOrderLineId).HasColumnName("purchase_order_line_id");
            line.Property(l => l.LotNumber).HasColumnName("lot_number").HasMaxLength(InventoryRules.MaxLotNumberLength);
            line.Property(l => l.ManufacturedOn).HasColumnName("manufactured_on").HasColumnType("date");
            line.Property(l => l.ExpiresOn).HasColumnName("expires_on").HasColumnType("date");
            line.Property(l => l.QuantityAccepted).HasColumnName("quantity_accepted").HasPrecision(12, 3).IsRequired();
            line.Property(l => l.QuantityRejected).HasColumnName("quantity_rejected").HasPrecision(12, 3).IsRequired();
            line.Property(l => l.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(40);
            line.Property(l => l.RejectionNote).HasColumnName("rejection_note").HasMaxLength(InventoryRules.NoteMaxLength);
            line.Property(l => l.LocationId).HasColumnName("location_id");
            line.Property(l => l.HoldForInspection).HasColumnName("hold_for_inspection").IsRequired();
            line.Property(l => l.UnitCostAmount).HasColumnName("unit_cost_amount").HasPrecision(14, 4);
            line.Property(l => l.UnitCostCurrency).HasColumnName("unit_cost_currency").HasMaxLength(3).IsFixedLength();
            line.Property(l => l.ExchangeRateToBase).HasColumnName("exchange_rate_to_base").HasPrecision(18, 6);
            line.Property(l => l.SortOrder).HasColumnName("sort_order").IsRequired();
        });
        builder.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
