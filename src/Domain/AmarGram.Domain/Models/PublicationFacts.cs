namespace AmarGram.Domain.Models;

/// <summary>
/// HO-SHP-001 section 8.4 -- the cross-aggregate facts the handler gathers before calling
/// <c>ProductAggregate.Publish</c>. <c>ProductPublicationRules.Evaluate</c> is pure and takes
/// exactly this plus the product itself. <c>Today</c> (HO-P4 BG-14) is the UTC calendar date the handler/read
/// evaluates against, so an organic certificate that has expired blocks publication; null skips that one check
/// (callers that have no date to give, e.g. pure unit tests of the other items).
/// </summary>
public sealed record PublicationFacts(
    IReadOnlyCollection<Guid> PricedSkuIds,
    bool TaxClassActive,
    IReadOnlyList<BundleComponentFact> BundleComponentFacts,
    DateOnly? Today = null);
