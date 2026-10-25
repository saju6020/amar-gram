using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Order;

/// <summary>HO-P4 BG-5 -- the in-house riders of one branch (the staff member's active branch), by name. <c>ActiveOnly</c> is what a dispatch chooses from.</summary>
public sealed class GetRidersQuery : Query<IReadOnlyList<RiderViewModel>>
{
    public required Guid BranchId { get; init; }
    public bool ActiveOnly { get; init; }
}
