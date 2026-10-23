using CatEcommerce.Domain.Models;

namespace CatEcommerce.Domain.DomainServices;

/// <summary>
/// A context's own hard-delete of its <c>Purgeable</c> records, under the retention schedule
/// (HO-XCT-001 §8.9, ADR-304). Registered by the owning area in its own module. The retention
/// worker (owned by HO-XCT-001, not built here) calls <see cref="PurgeAsync"/> once per pass,
/// batched, and never passes a table name -- only a context that owns the table may delete from
/// it. A source that holds stored objects deletes the object before the metadata
/// row, and is idempotent.
/// </summary>
public interface IRetentionPurgeSource
{
    /// <summary>Stable identifier for this source, e.g. "stored-file:ReportExport". Used in the
    /// <c>RetentionPassResult</c> audit row.</summary>
    string SourceKey { get; }

    /// <summary>Purges records older than <paramref name="cutoff"/>, at most
    /// <paramref name="batchSize"/> per call. Idempotent -- calling again with the same or a
    /// later cutoff purges only what is still eligible.</summary>
    Task<PurgeResult> PurgeAsync(DateTimeOffset cutoff, int batchSize, CancellationToken ct);
}
