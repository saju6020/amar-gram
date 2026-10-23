using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Models;

/// <summary>
/// One row of an <c>IRetentionReviewSource</c> result (HO-XCT-001 §8.10). Shape transcribed
/// verbatim from §8.10's own code block. Nothing named here is ever deleted automatically
/// (ADR-301) -- the count is a report line only: "Eligible for review. Nothing is deleted
/// automatically."
/// </summary>
public sealed record RetentionReviewCount(
    RecordClass RecordClass,
    string RecordKind,
    int Count,
    DateOnly? OldestAnchor);
