namespace AmarGram.Read.QueryHandlers.Operations;

/// <summary>
/// HO-XCT-001 section 8.11 -- a section of the offline front-desk snapshot. Registered as multiple Scoped services of this interface and consumed as
/// <c>IEnumerable</c>. A source returns the section body, or <c>null</c> to be omitted. HO-P1 retired the two sections that existed, so none is
/// registered today and the snapshot carries no sections.
/// </summary>
public interface IFrontDeskSnapshotSource
{
    string SectionKey { get; }

    /// <summary>The action the caller needs to receive this section, resolved against <c>ActionRoles</c>; <c>null</c> for no extra requirement.</summary>
    string? RequiredAction { get; }

    Task<object?> BuildAsync(Guid branchId, DateOnly localDate, TimeZoneInfo zone, CancellationToken ct);
}
