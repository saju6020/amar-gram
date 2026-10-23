using CatEcommerce.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace CatEcommerce.Read.Queries.Billing;

/// <summary>HO-BIL-001 §12.4 -- charges at the active branch. <see cref="Status"/> is <c>unbilled</c> (active and on
/// no live invoice), <c>billed</c> (on a live invoice) or <c>voided</c>; null lists all.</summary>
public sealed class GetChargesQuery : Query<PagedResult<ChargeViewModel>>
{
    public required Guid BranchId { get; init; }
    public Guid? CustomerId { get; init; }
    public string? Status { get; init; }
    public string? SourceKind { get; init; }
}

