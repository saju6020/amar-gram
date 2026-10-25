using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.DomainServices;

public enum CashUpRowKind
{
    Payment,
    Refund,
    Reversal,
}

/// <summary>
/// One line of a branch's day: an accepted payment, a refund paid out, or a reversal of an earlier
/// payment. <see cref="CarriedIn"/> marks a <b>late</b> item of an earlier, already-closed day that this
/// cash-up picks up (§8.10) -- such an item is counted once, in <c>carriedIn</c>, not in the day's own totals.
///
/// </summary>
public sealed record CashUpRow(
    Guid Id, CashUpRowKind Kind, PaymentMethod? Method, CollectorKind? Collector, RefundMethod? RefundMethod,
    decimal Amount, bool CarriedIn, string? Label = null, string? SourceKey = null, string? SourceLabel = null);

/// <summary>
/// HO-BIL-001 §8.10 (ADR-188) -- pure. <c>expectedCash = Σ accepted cash-in-store + Σ staff-collected COD
/// − Σ cash refunds − Σ reversals of the above + carriedIn</c>; card and transfer totals are listed, not
/// counted; courier-collected COD never counts (the courier holds it). The read side and the close both
/// call this one function, so the number the cashier saw is the number frozen.
/// </summary>
public static class CashUpCalculator
{
    public static CashUpSnapshot Calculate(IEnumerable<CashUpRow> rows)
    {
        decimal cash = 0m, card = 0m, transfer = 0m, cashRefunds = 0m, cashReversals = 0m, carriedIn = 0m;
        int cashCount = 0, cardCount = 0, transferCount = 0;

        foreach (var row in rows)
        {
            var signed = SignedCashEffect(row);

            if (row.CarriedIn)
            {
                carriedIn += signed;
                continue;
            }

            switch (row.Kind)
            {
                case CashUpRowKind.Payment:
                    switch (PaymentMethodRules.BucketOf(row.Method!, row.Collector))
                    {
                        case TillBucket.Cash: cash += row.Amount; cashCount++; break;
                        case TillBucket.Card: card += row.Amount; cardCount++; break;
                        case TillBucket.Transfer: transfer += row.Amount; transferCount++; break;
                    }

                    break;
                case CashUpRowKind.Refund:
                    // A refund counts against the till only when it was paid out in cash.
                    if (row.RefundMethod == RefundMethod.CashInStore) cashRefunds += row.Amount;
                    break;
                case CashUpRowKind.Reversal:
                    if (PaymentMethodRules.CountsInTill(row.Method!, row.Collector)) cashReversals += row.Amount;
                    break;
            }
        }

        var expected = cash - cashRefunds - cashReversals + carriedIn;
        return new CashUpSnapshot(cash, cashCount, card, cardCount, transfer, transferCount, cashRefunds, cashReversals, carriedIn, expected);
    }

    /// <summary>The effect on the till of one row, signed: money in is positive, money out negative.</summary>
    private static decimal SignedCashEffect(CashUpRow row) => row.Kind switch
    {
        CashUpRowKind.Payment => PaymentMethodRules.CountsInTill(row.Method!, row.Collector) ? row.Amount : 0m,
        CashUpRowKind.Refund => row.RefundMethod == RefundMethod.CashInStore ? -row.Amount : 0m,
        CashUpRowKind.Reversal => PaymentMethodRules.CountsInTill(row.Method!, row.Collector) ? -row.Amount : 0m,
        _ => 0m,
    };

    public static decimal Variance(decimal countedCash, decimal expectedCash) => countedCash - expectedCash;

    /// <summary>
    /// HO-P4 BG-20. The expected cash per source -- the signed cash effect of every row (carried-in items included, exactly as
    /// <see cref="Calculate"/> folds them into <c>ExpectedCash</c>), grouped by <see cref="CashUpRow.SourceKey"/> (a row with none is the
    /// till). The till is always listed. Rows that move no cash (card, transfer, courier-held) belong to no source. The amounts sum to
    /// <c>ExpectedCash</c>, so a per-source count and the overall count can never disagree about what was expected.
    /// </summary>
    public static IReadOnlyList<CashUpSourceExpected> CalculateSources(IEnumerable<CashUpRow> rows)
    {
        var totals = new Dictionary<string, (string Label, decimal Expected)>(StringComparer.Ordinal)
        {
            [CashUpSources.TillKey] = (CashUpSources.TillLabel, 0m),
        };

        foreach (var row in rows)
        {
            var signed = SignedCashEffect(row);
            if (signed == 0m) continue;

            var key = row.SourceKey ?? CashUpSources.TillKey;
            var label = row.SourceLabel ?? (key == CashUpSources.TillKey ? CashUpSources.TillLabel : key);
            totals[key] = totals.TryGetValue(key, out var existing)
                ? (existing.Label == key && label != key ? label : existing.Label, existing.Expected + signed)
                : (label, signed);
        }

        return totals
            .Select(t => new CashUpSourceExpected(t.Key, t.Value.Label, t.Value.Expected))
            .OrderBy(t => t.Key == CashUpSources.TillKey ? 0 : 1).ThenBy(t => t.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
