using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Infrastructure.Subscriptions;

/// <summary>
/// HO-SUB-001 §12.1 (ADR-237) -- the conventions both Subscriptions roots apply: their own schema <c>subscription</c>, ADR-021's corrections on every root
/// (<c>ValueGeneratedNever()</c> on the id; <c>Tags</c>/<c>Language</c>/<c>ServiceId</c> optional; the <c>xmin</c> row version, with <c>Events</c> and
/// <c>Metadata</c> ignored). The enumeration, money and instant column helpers are Ordering's (<c>OrderingMapping</c>), reused rather than copied.
/// </summary>
internal static class SubscriptionMapping
{
    public const string Schema = "subscription";

    public static EntityTypeBuilder<T> ConfigureSubscriptionRoot<T>(this EntityTypeBuilder<T> builder, string table) where T : AggregateRoot
    {
        builder.ToTable(table, Schema);
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Tags).IsRequired(false);
        builder.Property(x => x.Language).IsRequired(false);
        builder.Property(x => x.ServiceId).IsRequired(false);

        builder.Property<uint>("xmin").IsRowVersion();
        builder.Ignore(x => x.Events);
        builder.Ignore(x => x.Metadata);
        return builder;
    }
}
