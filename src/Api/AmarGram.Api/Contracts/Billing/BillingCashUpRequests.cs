namespace AmarGram.Api.Contracts.Billing;

/// <summary><c>PUT /api/staff/billing/cash-ups/{date}/count</c> (C20).</summary>
public sealed class RecordCashCountRequest
{
    /// <summary>The total, for a total-only count. Ignored when <c>counts</c> is given.</summary>
    public decimal CountedCash { get; init; }
    /// <summary>HO-P4 BG-20: the counted cash per source -- one entry per <c>sources[].key</c> of the cash-up read. The total is the server's sum of them.</summary>
    public IReadOnlyList<CashUpSourceCountRequest>? Counts { get; init; }
    public string? Explanation { get; init; }
}

public sealed class CashUpSourceCountRequest
{
    public string SourceKey { get; init; } = default!;
    public decimal CountedCash { get; init; }
}

/// <summary><c>POST /api/staff/billing/cash-ups/{date}/close</c> (C21).</summary>
public sealed class CloseCashUpRequest
{
    public int ExpectedVersion { get; init; }
}
