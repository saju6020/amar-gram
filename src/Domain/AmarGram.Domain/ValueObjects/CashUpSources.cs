namespace AmarGram.Domain.ValueObjects;

/// <summary>HO-P4 BG-20. What one source (the till, or one staff collector of cash-on-delivery) was expected to hold at close, frozen on the cash-up.</summary>
public sealed record CashUpSourceExpected(string Key, string Label, decimal ExpectedCash);

/// <summary>HO-P4 BG-20. The cash a cashier counted for one source. The label is kept so a closed day stays readable.</summary>
public sealed record CashUpSourceCount(string Key, string Label, decimal CountedCash);

/// <summary>HO-P4 BG-20. One source's expected / counted / variance. <c>Counted</c> and <c>Variance</c> are null while the source is uncounted
/// on a day that is still open.</summary>
public sealed record CashUpSourceReconciliation(string Key, string Label, decimal ExpectedCash, decimal? CountedCash, decimal? Variance);

/// <summary>
/// HO-P4 BG-20 -- pure. The "sources" of a day's cash are the places it is physically held and counted: the till (in-store cash, cash refunds
/// and reversals of those) and each staff member who collected cash on delivery. Courier-collected cash is not a source -- the courier holds it
/// until remitted (<c>CashUpCalculator</c>: it never counts in the till). Their sum is exactly <c>ExpectedCash</c>.
/// </summary>
public static class CashUpSources
{
    public const string TillKey = "till";
    public const string TillLabel = "Till";
    private const string StaffPrefix = "staff:";

    public static string StaffKey(Guid staffAccountId) => $"{StaffPrefix}{staffAccountId:D}";

    public static bool TryParseStaffKey(string? key, out Guid staffAccountId)
    {
        staffAccountId = Guid.Empty;
        return key is not null && key.StartsWith(StaffPrefix, StringComparison.Ordinal) && Guid.TryParse(key.AsSpan(StaffPrefix.Length), out staffAccountId);
    }

    /// <summary>
    /// Expected, counted and variance per source. The union of the expected and the counted keys is listed (a count for a source whose expected
    /// cash has since fallen to nothing still shows), the till first. <paramref name="missingCountIsZero"/> is true once the day is closed
    /// (an uncounted source was counted as nothing); while open it stays null so the screen can tell "not counted yet" from "counted zero".
    /// </summary>
    public static IReadOnlyList<CashUpSourceReconciliation> Reconcile(
        IReadOnlyList<CashUpSourceExpected> expected, IReadOnlyList<CashUpSourceCount> counted, bool missingCountIsZero)
    {
        var keys = expected.Select(e => e.Key).Concat(counted.Select(c => c.Key)).Distinct(StringComparer.Ordinal).ToList();
        var anyCounted = counted.Count > 0;

        var rows = keys.Select(key =>
        {
            var exp = expected.FirstOrDefault(e => e.Key == key);
            var cnt = counted.FirstOrDefault(c => c.Key == key);
            var expectedCash = exp?.ExpectedCash ?? 0m;
            decimal? countedCash = cnt?.CountedCash ?? (anyCounted && missingCountIsZero ? 0m : null);
            return new CashUpSourceReconciliation(
                key, exp?.Label ?? cnt?.Label ?? key, expectedCash, countedCash, countedCash is { } c ? c - expectedCash : null);
        });

        return rows.OrderBy(r => r.Key == TillKey ? 0 : 1).ThenBy(r => r.Label, StringComparer.OrdinalIgnoreCase).ToList();
    }
}
