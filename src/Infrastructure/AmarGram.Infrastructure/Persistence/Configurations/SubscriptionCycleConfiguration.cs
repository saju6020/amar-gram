using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Infrastructure.Ordering;
using AmarGram.Infrastructure.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AmarGram.Infrastructure.Persistence.Configurations;

/// <summary>
/// HO-SUB-001 §12.1 -- <c>subscription.subscription_cycle</c>. <c>ix_subscription_cycle_per_date</c> is the exactly-once backstop (ADR-241): a second pass
/// recording the same cycle collides here and is treated as success. <c>ix_subscription_cycle_order</c> serves the order-outcome mirror (ADR-243). There is no
/// foreign key to the subscription or the order: the slice holds ids only (ADR-237), exactly as Orders holds a customer id.
/// </summary>
public sealed class SubscriptionCycleConfiguration : IEntityTypeConfiguration<SubscriptionCycleAggregate>
{
    public void Configure(EntityTypeBuilder<SubscriptionCycleAggregate> builder)
    {
        builder.ConfigureSubscriptionRoot("subscription_cycle");

        builder.Property(x => x.SubscriptionId).HasColumnName("subscription_id").IsRequired();
        builder.Property(x => x.CustomerId).HasColumnName("customer_id").IsRequired();
        builder.Property(x => x.CycleOn).HasColumnName("cycle_on").HasColumnType("date").IsRequired();
        builder.Property(x => x.SkuId).HasColumnName("sku_id").IsRequired();
        builder.Property(x => x.Quantity).HasColumnName("quantity").IsRequired();
        builder.Property(x => x.Fulfilment).HasEnumeration("fulfilment");
        builder.Property(x => x.PaymentMethod).HasEnumeration("payment_method");
        builder.Property(x => x.DiscountPercent).HasColumnName("discount_percent").HasColumnType("numeric(5,2)").IsRequired();
        builder.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(60).IsRequired();
        builder.Property(x => x.Outcome).HasEnumeration("outcome");
        builder.Property(x => x.OrderId).HasColumnName("order_id");
        builder.Property(x => x.OrderNumber).HasColumnName("order_number").HasMaxLength(40);
        builder.Property(x => x.OrderState).HasNullableEnumeration("order_state");
        builder.Property(x => x.PaymentExpiresOn).HasInstant("payment_expires_on");
        builder.Property(x => x.FailureReason).HasNullableEnumeration("failure_reason");
        builder.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(100);
        builder.Property(x => x.ProcessedOn).HasInstant("processed_on").IsRequired();
        builder.Property(x => x.OrderStateChangedOn).HasInstant("order_state_changed_on");

        builder.Ignore(x => x.IsUnpaid);

        builder.HasIndex(x => new { x.SubscriptionId, x.CycleOn }).IsUnique().HasDatabaseName("ix_subscription_cycle_per_date");
        builder.HasIndex(x => x.OrderId).IsUnique().HasDatabaseName("ix_subscription_cycle_order").HasFilter("order_id IS NOT NULL");
        builder.HasIndex(x => new { x.CustomerId, x.CycleOn }).HasDatabaseName("ix_subscription_cycle_customer");
    }
}
