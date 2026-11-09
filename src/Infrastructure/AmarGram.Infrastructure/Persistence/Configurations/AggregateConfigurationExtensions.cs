using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Infrastructure.Persistence.Configurations;

/// <summary>The conventions an aggregate configuration repeats (ADR-021,
/// HO-ACC-001 §12.1): an enumeration is stored by its <c>Value</c>; the optional platform base columns
/// <c>Tags</c>/<c>Language</c>/<c>ServiceId</c> are not required; <c>xmin</c> is the concurrency token;
/// <c>Events</c>/<c>Metadata</c> are not persisted. First written for HO-EMR-001 §12.1; kept
/// for the configurations that still use it (HO-P1).</summary>
internal static class AggregateConfigurationExtensions
{
    public static PropertyBuilder<TEnum> HasEnumerationValue<TEnum>(this PropertyBuilder<TEnum> builder) where TEnum : Enumeration =>
        builder.HasConversion(v => v.Value, v => Enumeration.FromValue<TEnum>(v));

    public static void ConfigureAggregateBase<T>(this EntityTypeBuilder<T> builder) where T : AggregateRoot
    {
        builder.HasKey(x => x.Id);
        // ValueGeneratedNever on every root and nested owned id (ADR-021): left at the default a NEW owned
        // child is sent as an UPDATE of a row that does not exist and the xmin check throws.
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Tags).IsRequired(false);
        builder.Property(x => x.Language).IsRequired(false);
        builder.Property(x => x.ServiceId).IsRequired(false);
        builder.Property<uint>("xmin").IsRowVersion();
        builder.Ignore(x => x.Events);
        builder.Ignore(x => x.Metadata);
    }
}
