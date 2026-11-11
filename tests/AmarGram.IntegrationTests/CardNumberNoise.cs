using System.Text.RegularExpressions;
using AmarGram.Shared.Common.Helpers;

namespace AmarGram.IntegrationTests;

/// <summary>
/// The ONE place the card-number sweeps (XI-9 over the database, I-X1 over the captured logs, the trace sweep) decide which long digit runs are NOT card numbers: ids and instants.
/// Every alternative is anchored on both sides (no letter or digit directly against it), so a card number glued to an instant is not eaten by the mask; the fraction of an instant
/// is bounded to 7 digits. <c>CardNumberNoiseTests</c> proves that "blank noise, then ask <see cref="CardNumberGuard"/>" still flags real card numbers.
/// Bangladeshi mobile numbers (880 1[3-9] + 8 digits) need no entry: the guard itself excludes them.
/// One known limit, by design: a token of 24 or more hex characters is an id, so a card number written glued to hex letters up to that length is read as an id too.
/// </summary>
public static partial class CardNumberNoise
{
    // Hex ids of 24+ characters (a provider message id, a product link), dashed GUIDs, ISO instants, culture-formatted instants (11/11/2026 05:26:42 PM +00:00), our document
    // numbers; and JSON's own backslash-u escapes (four hex digits next to the value they quote).
    [GeneratedRegex(
        @"(?<![0-9A-Za-z])(?:[0-9a-fA-F]{24,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" +
        @"|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})?" +
        @"|\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}:\d{2}(?: [AP]M)?(?: [+-]\d{2}:\d{2})?" +
        @"|(?:INV|CN)-[A-Za-z0-9]+-\d{4}-\d{6})(?![0-9A-Za-z])" +
        @"|\\u[0-9A-Fa-f]{4}")]
    private static partial Regex Core();

    // The trace lines also carry 13-digit millisecond epochs starting with 1.
    [GeneratedRegex(@"(?<![0-9A-Za-z])1\d{12}(?![0-9A-Za-z])")]
    private static partial Regex EpochMilliseconds();

    /// <summary>A 13 to 19 digit run (single spaces or dashes allowed between digits).</summary>
    [GeneratedRegex(@"(?:\d[ -]?){13,19}")]
    public static partial Regex DigitRun();

    /// <summary>Blanks ids and instants (each replaced by a space) so what is left can be asked of the card-number guard.</summary>
    public static string Blank(string text) => Core().Replace(text, " ");

    /// <summary>As <see cref="Blank"/>, plus the 13-digit millisecond epochs of trace lines.</summary>
    public static string BlankTrace(string text) => EpochMilliseconds().Replace(Core().Replace(text, " "), " ");

    /// <summary>The runs left after blanking that the guard calls card-like.</summary>
    public static IReadOnlyList<string> CardLikeRuns(string text, bool trace = false) =>
        DigitRun().Matches(trace ? BlankTrace(text) : Blank(text)).Select(m => m.Value).Where(CardNumberGuard.LooksLikeCardNumber).ToList();
}
