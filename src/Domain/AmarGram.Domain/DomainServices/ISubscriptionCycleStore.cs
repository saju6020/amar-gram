using AmarGram.Domain.Aggregates.Subscription;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-SUB-001 §11.4 C8 (ADR-240, ADR-241) -- saves a new cycle and reports a lost race cleanly. The handler has already loaded and mutated the subscription (it is
/// <b>tracked</b> by the scoped context), so saving the cycle commits both in one <c>SaveChangesAsync</c> (F23): the cycle row and the advanced subscription are
/// atomic. A collision on <c>ix_subscription_cycle_per_date</c> means another pass recorded the same cycle first: returns <c>false</c> (the caller treats it as
/// success), as <c>INotificationRequestStore</c> does for a duplicate notice. Implemented in Infrastructure, where the database exception is known.
/// </summary>
public interface ISubscriptionCycleStore
{
    Task<bool> TrySaveAsync(SubscriptionCycleAggregate cycle, CancellationToken ct = default);
}
