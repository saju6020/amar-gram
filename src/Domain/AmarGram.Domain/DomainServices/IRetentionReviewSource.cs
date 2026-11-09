using AmarGram.Domain.Models;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// A financial context's own count of records past their retention period
/// (HO-XCT-001 §8.10, §5.2 C-ALL-3). Registered by the owning area in its own module: BIL and
/// IMP each provide one. Financial: <c>retention.financialYears</c> after the document date
/// (D-9). The end of a period is a review flag only -- **never** an automatic delete or
/// anonymisation (ADR-301).
/// </summary>
public interface IRetentionReviewSource
{
    /// <summary>Stable identifier for this source, e.g. "billing".</summary>
    string SourceKey { get; }

    Task<IReadOnlyList<RetentionReviewCount>> CountPastRetentionAsync(DateOnly asOf, CancellationToken ct);
}
