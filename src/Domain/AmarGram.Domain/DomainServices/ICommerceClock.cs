using AmarGram.Domain.ValueObjects;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-SUB-001 §8.13 (ADR-239) -- loads the main branch's time zone and <c>subscription.changeCutoffDays</c> and returns a <see cref="SubscriptionClock"/> for the
/// current instant (<c>TimeProvider</c>). Used by every Subscriptions handler and the worker; the only place that reads the zone. Implemented in Infrastructure.
/// </summary>
public interface ICommerceClock
{
    Task<SubscriptionClock> GetAsync(CancellationToken ct = default);

    /// <summary>The same zone and cut-off, at an explicit instant (read side and tests).</summary>
    Task<SubscriptionClock> GetAtAsync(DateTimeOffset now, CancellationToken ct = default);
}
