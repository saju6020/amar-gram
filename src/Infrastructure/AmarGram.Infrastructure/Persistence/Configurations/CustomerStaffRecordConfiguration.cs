using AmarGram.Domain.Aggregates.Account;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AmarGram.Infrastructure.Persistence.Configurations;

/// <summary>HO-P4 BG-19. Schema <c>account</c>. Id is the customer id -- a 1:1 shared key, like the address book. Personal data
/// (<c>AggregateOnly</c> in <c>RecordClassification</c>): the rows go through <c>CustomerStaffRecordAggregate.Clear</c> on anonymisation.</summary>
public sealed class CustomerStaffRecordConfiguration : IEntityTypeConfiguration<CustomerStaffRecordAggregate>
{
    public void Configure(EntityTypeBuilder<CustomerStaffRecordAggregate> builder)
    {
        builder.ToTable("customer_staff_record", "account");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.PrimitiveCollection(x => x.Labels)
            .HasColumnName("labels")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .ElementType(e => e.HasMaxLength(30));
        // Tag filter on the customer list: labels @> ARRAY['vip'] -- by label, case as stored.
        builder.HasIndex(x => x.Labels).HasDatabaseName("ix_customer_staff_record_labels").HasMethod("GIN");

        builder.OwnsMany(x => x.Notes, note =>
        {
            note.ToTable("customer_staff_note", "account");
            note.WithOwner().HasForeignKey("customer_id");
            note.HasKey("Id");
            note.Property(n => n.Id).ValueGeneratedNever();
            note.Property(n => n.AuthorStaffId).HasColumnName("author_staff_id").IsRequired();
            note.Property(n => n.Text).HasColumnName("text").HasMaxLength(1000).IsRequired();
            note.Property(n => n.CreatedOn).HasColumnName("created_on").HasColumnType("timestamptz");
        });
        builder.Navigation(x => x.Notes).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(x => x.Tags).IsRequired(false);
        builder.Property(x => x.Language).IsRequired(false);
        builder.Property(x => x.ServiceId).IsRequired(false);

        builder.Property<uint>("xmin").IsRowVersion();
        builder.Ignore(x => x.Events);
        builder.Ignore(x => x.Metadata);
    }
}
