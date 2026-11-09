namespace AmarGram.Read.ViewModels;

public sealed record SnapshotBranch(Guid Id, string Name, string TimeZoneId);

public sealed record SnapshotOmittedSection(string Section, string Reason);

/// <summary>The snapshot body, schema version 1.</summary>
public sealed record FrontDeskSnapshotBody(
    int SchemaVersion, SnapshotBranch Branch, string LocalDate, DateTimeOffset GeneratedOn, DateTimeOffset ValidUntil, Guid StaffAccountId,
    int IdleTimeoutMinutes, int RefreshAfterSeconds, IReadOnlyDictionary<string, object> Sections, IReadOnlyList<SnapshotOmittedSection> OmittedSections);

/// <summary>The snapshot with its strong ETag (SHA-256 of the canonical content, excluding <c>GeneratedOn</c>) and the item count per section.</summary>
public sealed record FrontDeskSnapshotViewModel(
    string ETag, DateOnly LocalDate, IReadOnlyDictionary<string, int> SectionCounts, FrontDeskSnapshotBody Body);
