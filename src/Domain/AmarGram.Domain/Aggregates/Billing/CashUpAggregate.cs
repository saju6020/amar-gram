using AmarGram.Domain.Events.Billing;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Billing;

/// <summary>
/// HO-BIL-001 section 8.10 (US-BIL-12, US-BIL-06 AC3, ADR-188) -- one till count per <c>(branch, business date)</c>. The cashier records the
/// counted cash (as often as needed while the day is <c>Open</c>); the close freezes the expected totals the calculator produced, works
/// out the variance, and refuses a non-zero variance without an explanation. <b>Closed is terminal</b> -- there is no reopen (OQ-12).
/// The id is derived from the pair (<see cref="CashUpIds"/>) so "load or create" cannot create two.
/// </summary>
public sealed class CashUpAggregate : AggregateRoot
{
    public Guid BranchId { get; private set; }
    public DateOnly BusinessDate { get; private set; }
    public CashUpStatus Status { get; private set; } = default!;
    public decimal? CountedCash { get; private set; }
    public Guid? CountedBy { get; private set; }
    public DateTimeOffset? CountedOn { get; private set; }
    public decimal? Variance { get; private set; }
    public string? Explanation { get; private set; }
    public Guid? ClosedBy { get; private set; }
    public DateTimeOffset? ClosedOn { get; private set; }
    public CashUpSnapshot? ExpectedSnapshot { get; private set; }

    /// <summary>HO-P4 BG-20. The counted cash per source (till, each staff collector) when the cashier counted by source; empty for a total-only
    /// count. <see cref="CountedCash"/> is always their sum, so everything that reads the one total keeps working.</summary>
    public IReadOnlyList<CashUpSourceCount> SourceCounts { get; private set; } = [];

    /// <summary>HO-P4 BG-20. The expected cash per source, frozen on close alongside <see cref="ExpectedSnapshot"/>; empty until then.</summary>
    public IReadOnlyList<CashUpSourceExpected> ExpectedSources { get; private set; } = [];

    private CashUpAggregate() { }

    public CashUpAggregate(Guid id) : base(id) { }

    public void Open(Guid branchId, DateOnly businessDate, UserContext userContext)
    {
        BranchId = branchId;
        BusinessDate = businessDate;
        Status = CashUpStatus.Open;

        SetDefaultValue(userContext);
        UpdateVersion();
    }

    /// <summary>The date is today or earlier in branch time; a recount replaces the earlier count.</summary>
    public void RecordCount(decimal countedCash, string? explanation, DateOnly todayLocal, DateTimeOffset now, BillingActor actor)
    {
        RequireOpen();

        if (BusinessDate > todayLocal)
            throw new DomainRuleViolationException(BusinessViolationCodes.CashUpDateInFuture, "A till cannot be counted for a day that has not started.", nameof(BusinessDate));

        if (countedCash < 0m || decimal.Round(countedCash, 2) != countedCash || countedCash > BillingRules.MaxAmount)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidAmount, "The counted cash must be zero or more, with at most two decimals.", nameof(countedCash));

        var text = string.IsNullOrWhiteSpace(explanation) ? null : explanation.Trim();
        if (text is { Length: > BillingRules.MaxReasonLength })
            throw new DomainRuleViolationException(BusinessViolationCodes.ReasonRequired, $"An explanation can be at most {BillingRules.MaxReasonLength} characters.", nameof(explanation));
        BillingFreeText.RefuseCardNumber(text, nameof(explanation));

        CountedCash = countedCash;
        SourceCounts = [];
        CountedBy = actor.UserId;
        CountedOn = now;
        Explanation = text;

        UpdateVersion();
    }

    /// <summary>
    /// HO-P4 BG-20. Records the count <b>per source</b> and sets the one total to their sum (server-computed, never taken from the caller). The
    /// same date, open-day, amount and explanation rules as <see cref="RecordCount"/> apply to every amount and the total. Each source must be one
    /// the day actually has (<paramref name="knownSources"/> -- the till and the staff collectors in the day's expected lines) and may appear once.
    /// A source left out is counted as nothing at the close. A recount replaces the earlier count.
    /// </summary>
    public void RecordSourceCounts(
        IReadOnlyList<CashUpSourceCount> counts, IReadOnlyCollection<string> knownSources, string? explanation,
        DateOnly todayLocal, DateTimeOffset now, BillingActor actor)
    {
        RequireOpen();

        if (counts.Count == 0)
            throw new DomainRuleViolationException(BusinessViolationCodes.CountRequired, "Count at least one source.", nameof(counts));

        if (counts.Select(c => c.Key).Distinct(StringComparer.Ordinal).Count() != counts.Count)
            throw new DomainRuleViolationException(BusinessViolationCodes.DuplicateCashUpSource, "Each source can be counted once.", nameof(counts));

        foreach (var count in counts)
        {
            if (!knownSources.Contains(count.Key, StringComparer.Ordinal))
                throw new DomainRuleViolationException(BusinessViolationCodes.UnknownCashUpSource, "This day has no such source of cash.", nameof(counts));

            if (count.CountedCash < 0m || decimal.Round(count.CountedCash, 2) != count.CountedCash || count.CountedCash > BillingRules.MaxAmount)
                throw new DomainRuleViolationException(BusinessViolationCodes.InvalidAmount, "Each counted amount must be zero or more, with at most two decimals.", nameof(counts));
        }

        var total = counts.Sum(c => c.CountedCash);
        RecordCount(total, explanation, todayLocal, now, actor);
        SourceCounts = counts.ToList();
    }

    /// <summary>Freezes the expected totals, computes the variance and closes. A variance other than zero needs an explanation (US-BIL-12 AC2).</summary>
    public void Close(CashUpSnapshot snapshot, DateTimeOffset now, BillingActor actor, IReadOnlyList<CashUpSourceExpected>? expectedSources = null)
    {
        RequireOpen();

        if (CountedCash is not { } counted)
            throw new DomainRuleViolationException(BusinessViolationCodes.CountRequired, "Count the cash before closing the day.", nameof(CountedCash));

        var variance = counted - snapshot.ExpectedCash;
        if (variance != 0m && string.IsNullOrWhiteSpace(Explanation))
            throw new DomainRuleViolationException(BusinessViolationCodes.VarianceExplanationRequired, BillingMessages.VarianceExplanationRequired, nameof(Explanation));

        Variance = variance;
        ExpectedSnapshot = snapshot;
        ExpectedSources = expectedSources ?? [];
        Status = CashUpStatus.Closed;
        ClosedBy = actor.UserId;
        ClosedOn = now;

        AddDomainEvent(new CashUpClosedEvent
        {
            CashUpId = Id, BranchId = BranchId, BusinessDate = BusinessDate, Variance = variance,
            CorrelationId = actor.CorrelationId, UserContext = actor.UserContext,
        });
        UpdateVersion();
    }

    private void RequireOpen()
    {
        if (Status != CashUpStatus.Open)
            throw new DomainRuleViolationException(BusinessViolationCodes.CashUpClosed, "This day is closed and can no longer be changed.", nameof(Status));
    }
}

/// <summary>The cash-up id of a <c>(branch, date)</c> -- deterministic, so the same pair is always the same row.</summary>
public static class CashUpIds
{
    public static Guid For(Guid branchId, DateOnly businessDate)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"cash-up:{branchId:N}:{businessDate:yyyy-MM-dd}"));
        return new Guid(bytes.AsSpan(0, 16));
    }
}
