using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Ordering;
using AmarGram.Infrastructure.Subscriptions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AmarGram.Infrastructure.Persistence.Configurations;

/// <summary>
/// HO-SUB-001 §12.1 -- <c>subscription.subscription</c> with owned <c>Product</c>, <c>Terms</c> and <c>PendingTerms</c> as prefixed columns
/// (<c>terms_*</c>, <c>pending_terms_*</c>). <c>ix_subscription_live_per_sku</c> is the "one live subscription per customer and SKU" rule (a double-click or a
/// parallel create is <c>400 SubscriptionAlreadyExists</c>); its status predicate is built from the enumeration, never typed as literals. Adapted from the
/// original: with the cat retired the index is on <c>(customer_id, sku_id)</c> alone, so it needs no <c>NULLS NOT DISTINCT</c>.
/// </summary>
public sealed class SubscriptionConfiguration : IEntityTypeConfiguration<SubscriptionAggregate>
{
    public void Configure(EntityTypeBuilder<SubscriptionAggregate> builder)
    {
        builder.ConfigureSubscriptionRoot("subscription");

        builder.Property(x => x.CustomerId).HasColumnName("customer_id").IsRequired();
        builder.Property(x => x.SkuId).HasColumnName("sku_id").IsRequired();

        builder.OwnsOne(x => x.Product, p =>
        {
            p.Property(v => v.ProductName).HasColumnName("product_name").HasMaxLength(200).IsRequired();
            p.Property(v => v.VariantLabel).HasColumnName("variant_label").HasMaxLength(200).IsRequired();
        });
        builder.Navigation(x => x.Product).IsRequired();

        builder.OwnsOne(x => x.Terms, t => ConfigureTerms(t, "terms_"));
        builder.Navigation(x => x.Terms).IsRequired();

        builder.OwnsOne(x => x.PendingTerms, t => ConfigureTerms(t, "pending_terms_"));

        builder.Property(x => x.PendingSkip).HasColumnName("pending_skip").IsRequired();
        builder.Property(x => x.PendingStatusChange).HasNullableEnumeration("pending_status_change");
        builder.Property(x => x.Status).HasEnumeration("status");
        builder.Property(x => x.SuspensionReason).HasNullableEnumeration("suspension_reason");
        builder.Property(x => x.SuspendedOn).HasInstant("suspended_on");
        builder.Property(x => x.NextDeliveryOn).HasColumnName("next_delivery_on").HasColumnType("date");
        builder.Property(x => x.NextDeliverySetOn).HasColumnName("next_delivery_set_on").HasColumnType("date");
        builder.Property(x => x.StartedOn).HasColumnName("started_on").HasColumnType("date").IsRequired();
        builder.Property(x => x.LastCycleOn).HasColumnName("last_cycle_on").HasColumnType("date");
        builder.Property(x => x.LastSkippedOn).HasColumnName("last_skipped_on").HasColumnType("date");
        builder.Property(x => x.PausedOn).HasInstant("paused_on");
        builder.Property(x => x.CancelledOn).HasInstant("cancelled_on");
        builder.Property(x => x.CancelledBy).HasColumnName("cancelled_by");
        builder.Property(x => x.CancellationReason).HasNullableEnumeration("cancellation_reason");
        builder.Property(x => x.CancellationNote).HasColumnName("cancellation_note").HasMaxLength(SubscriptionRules.MaxNoteLength);
        builder.Property(x => x.ReinstatedOn).HasInstant("reinstated_on");
        builder.Property(x => x.ReinstatedBy).HasColumnName("reinstated_by");
        builder.Property(x => x.ReinstatementReason).HasColumnName("reinstatement_reason").HasMaxLength(SubscriptionRules.MaxNoteLength);

        builder.HasIndex(x => new { x.CustomerId, x.SkuId }).IsUnique().HasDatabaseName("ix_subscription_live_per_sku")
            .HasFilter($"status IN ({SubscriptionStatus.Active.Value}, {SubscriptionStatus.Paused.Value}, {SubscriptionStatus.Suspended.Value})");
        builder.HasIndex(x => new { x.Status, x.NextDeliveryOn }).HasDatabaseName("ix_subscription_status_next_delivery");
        builder.HasIndex(x => new { x.CustomerId, x.Status }).HasDatabaseName("ix_subscription_customer_status");
        builder.HasIndex(x => new { x.Status, x.SuspensionReason }).HasDatabaseName("ix_subscription_status_suspension");
        builder.HasIndex(x => x.SkuId).HasDatabaseName("ix_subscription_sku");
    }

    private static void ConfigureTerms(OwnedNavigationBuilder<SubscriptionAggregate, SubscriptionTerms> t, string prefix)
    {
        t.Property(v => v.Quantity).HasColumnName(prefix + "quantity");
        t.Property(v => v.IntervalWeeks).HasColumnName(prefix + "interval_weeks");
        t.Property(v => v.Fulfilment).HasEnumeration(prefix + "fulfilment");
        t.Property(v => v.DeliveryAddressId).HasColumnName(prefix + "delivery_address_id");
        t.Property(v => v.PickupBranchId).HasColumnName(prefix + "pickup_branch_id");
        t.Property(v => v.PaymentMethod).HasEnumeration(prefix + "payment_method");
    }
}
