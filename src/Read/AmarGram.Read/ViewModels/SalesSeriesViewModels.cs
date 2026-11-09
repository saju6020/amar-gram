namespace AmarGram.Read.ViewModels;

/// <summary>HO-P4 BG-1 -- one branch-local day of the sales series: its net revenue (zero when nothing was invoiced) and the orders placed that day (cancelled ones excluded).</summary>
public sealed record SalesSeriesDayViewModel(DateOnly Date, MoneyViewModel Net, int Orders);

/// <summary>HO-P4 BG-1 -- the per-day sales series, oldest day first, every day present. <c>Total</c> is the sum of the days' net revenue.</summary>
public sealed record SalesSeriesViewModel(
    Guid BranchId, string BranchName, DateOnly From, DateOnly To, string TimeZoneId, string CurrencyCode, MoneyViewModel Total, DateTimeOffset GeneratedOn,
    IReadOnlyList<SalesSeriesDayViewModel> Days);

/// <summary>The series, or the refusal (no resolvable branch).</summary>
public sealed record SalesSeriesOutcome(SalesSeriesViewModel? Result, string? RefusalCode)
{
    public bool IsRefused => RefusalCode is not null;
}
