using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Reporting;

/// <summary>
/// HO-P4 BG-1 -- the per-day sales series behind the staff dashboard's chart: the last <see cref="Days"/> branch-local days (today included) at the caller's active branch.
/// Net revenue per day is the revenue reports' own figure (invoice lines less credit notes, excluding tax, by the day they were issued -- <c>RevenueBuilder</c>), and
/// <c>orders</c> counts the day's placed, not-cancelled orders. Gated by <c>Reports.SalesView</c> at the Api.
/// </summary>
public sealed class GetSalesSeriesQuery : Query<SalesSeriesOutcome>
{
    public const int DefaultDays = 14;
    public const int MaxDays = 31;

    public required Guid CallerId { get; init; }
    public Guid? ActiveBranchId { get; init; }
    public int Days { get; init; } = DefaultDays;
}
