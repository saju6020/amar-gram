using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Administration;

/// <summary>HO-P4 BG-23 -- the roster grid's cells: each rostered person's effective shift per date.</summary>
public sealed class GetRosterCellsQuery : Query<IReadOnlyList<RosterCellViewModel>>
{
    public required Guid BranchId { get; init; }
    public required DateOnly From { get; init; }
    public required DateOnly To { get; init; }
    public Guid? StaffAccountId { get; init; }
}
