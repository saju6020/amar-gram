using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Billing;

/// <summary>HO-BIL-001 section 11.1 C20 (US-BIL-12, US-BIL-06 AC3) -- record (or replace) the counted cash of a day; the branch is the active branch.</summary>
public sealed class RecordCashCountCommand : Command
{
    public required Guid BranchId { get; init; }
    public required DateOnly BusinessDate { get; init; }
    /// <summary>The one total (a total-only count). Ignored when <see cref="Counts"/> is given -- the total is then their sum, computed by the aggregate.</summary>
    public required decimal CountedCash { get; init; }
    /// <summary>HO-P4 BG-20: the counted cash per source (till, each staff collector). Absent or empty means a total-only count.</summary>
    public IReadOnlyList<CashUpSourceCountInput>? Counts { get; init; }
    public string? Explanation { get; init; }
}

/// <summary>HO-P4 BG-20. <paramref name="SourceKey"/> is a <c>sources[].key</c> of the cash-up read ("till" or "staff:{staffAccountId}").</summary>
public sealed record CashUpSourceCountInput(string SourceKey, decimal CountedCash);

/// <summary>C21 -- close the day: freeze the expected totals, compute the variance. Terminal.</summary>
public sealed class CloseCashUpCommand : Command
{
    public required Guid BranchId { get; init; }
    public required DateOnly BusinessDate { get; init; }
    public required int ExpectedVersion { get; init; }
}
