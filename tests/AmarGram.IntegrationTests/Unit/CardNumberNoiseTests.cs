using Xunit;

namespace AmarGram.IntegrationTests.Unit;

/// <summary>
/// The card-number sweeps (XI-9, I-X1, the trace sweep) blank ids and instants and then ask the guard. These tests keep that pipeline honest in both directions: real card numbers
/// still come out flagged -- alone, spaced, dashed, next to an instant or an id in either order, and glued to an instant -- and the ids and instants themselves do not.
/// </summary>
public sealed class CardNumberNoiseTests
{
    private const string Pan = "4111111111111111";
    private const string Instant = "2026-11-11T10:00:00Z";
    private const string UsInstant = "11/11/2026 10:00:00 AM +00:00";
    private const string Guid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

    public static TheoryData<string> CardCases() => new()
    {
        Pan,
        "4111 1111 1111 1111",
        "4111-1111-1111-1111",
        "4880123456789012",                        // a "880" inside the number must not mask it
        "5880123456789019 declined",
        $"note {Pan} at {UsInstant}",
        $"{Instant} 4111-1111-1111-1111",
        $"{Pan} {Guid}",
        $"{Guid} {Pan}",
        $"{Pan} {Instant}",
        $"{UsInstant} {Pan}",
        $"{Instant}-4111 1111 1111 1111",
        // glued directly to an instant: the mask must not eat the card number
        $"{Pan}/1/2026 10:00:00",
        $"2026-11-11T10:00:00.{Pan}Z",
    };

    [Theory]
    [MemberData(nameof(CardCases))]
    public void ABlankedLog_StillShowsARealCardNumber(string text)
    {
        Assert.NotEmpty(CardNumberNoise.CardLikeRuns(text));
        Assert.NotEmpty(CardNumberNoise.CardLikeRuns(text, trace: true));
    }

    [Theory]
    [InlineData("2026-11-11T10:00:00.1234567Z")]
    [InlineData("11/11/2026 05:26:42 PM +00:00")]
    [InlineData("3f2504e0-4f89-11d3-9a0c-0305e82c3301")]
    [InlineData("INV-DHA-2026-000123")]
    [InlineData("8801712345678")]                  // a Bangladeshi mobile with the country code: the guard excludes it
    [InlineData("provider id 4111111111111111aaaaaaaa")] // 24+ hex characters in one token are an id
    public void IdsAndInstants_AreNotCardNumbers(string text) => Assert.Empty(CardNumberNoise.CardLikeRuns(text));

    [Fact]
    public void TheTraceSweep_AlsoBlanksMillisecondEpochs_TheOthersDoNot()
    {
        const string epoch = "1731319200000";   // 13 digits, starts with 1
        Assert.Empty(CardNumberNoise.CardLikeRuns($"ticks {epoch}", trace: true));
        Assert.Equal(CardNumberNoise.Blank($"ticks {epoch}"), $"ticks {epoch}");
    }
}
