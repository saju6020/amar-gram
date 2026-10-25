namespace AmarGram.Domain.ValueObjects;

/// <summary>
/// HO-SUB-001 §8.5 (ADR-239) -- the one place a time-zone conversion happens in the Subscriptions slice. Cycles are <b>local dates</b> in the commerce time zone
/// (the main branch's); the clock answers what "today" is there, when a cycle's order becomes <i>committed</i> (the cut-off: local midnight
/// <c>cutoffDays</c> before the cycle) and the earliest date a person may choose. Pure: built by the handler from <c>ICommerceClock</c>, with the instant it
/// was asked for.
/// </summary>
public sealed class SubscriptionClock
{
    private readonly TimeZoneInfo _zone;

    private SubscriptionClock(DateTimeOffset now, TimeZoneInfo zone, int cutoffDays)
    {
        Now = now;
        _zone = zone;
        CutoffDays = cutoffDays;
        Today = LocalDateOf(now);
    }

    public static SubscriptionClock Create(DateTimeOffset now, TimeZoneInfo zone, int cutoffDays)
    {
        ArgumentNullException.ThrowIfNull(zone);
        ArgumentOutOfRangeException.ThrowIfNegative(cutoffDays);
        return new SubscriptionClock(now, zone, cutoffDays);
    }

    public DateTimeOffset Now { get; }
    public int CutoffDays { get; }

    /// <summary>The local date of <see cref="Now"/> in the commerce zone.</summary>
    public DateOnly Today { get; }

    public string ZoneId => _zone.Id;

    /// <summary>The cycle's cut-off: local midnight at the start of <c>cycleOn - cutoffDays</c>, as an instant (UTC offset, so it can be stored: Npgsql writes only offset 0).</summary>
    public DateTimeOffset CutoffInstant(DateOnly cycleOn)
    {
        var local = cycleOn.AddDays(-CutoffDays).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, _zone.GetUtcOffset(local)).ToUniversalTime();
    }

    /// <summary>The cycle's order is committed: its terms are fixed and later changes wait for the following cycle.</summary>
    public bool IsLocked(DateOnly cycleOn) => Now >= CutoffInstant(cycleOn);

    /// <summary>The earliest date a person may choose: its own cut-off is still in the future.</summary>
    public DateOnly EarliestDeliveryOn => Today.AddDays(CutoffDays + 1);

    public DateOnly LocalDateOf(DateTimeOffset instant) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, _zone).DateTime);

    /// <summary>An instant as a local wall-clock time in the commerce zone (for display text).</summary>
    public DateTime LocalTimeOf(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, _zone).DateTime;
}
