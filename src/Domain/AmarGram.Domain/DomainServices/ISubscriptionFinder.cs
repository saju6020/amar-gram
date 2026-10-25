namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-SUB-001 §11.4, §11.6 -- the small lookups a command or event handler needs across rows (a live count, a duplicate check, the ids of a customer's
/// subscriptions and cycles), as ids and numbers only so no aggregate is loaded (the same shape as Ordering's <c>IOrderFinder</c>). Implemented in Infrastructure.
/// </summary>
public interface ISubscriptionFinder
{
    /// <summary>Subscriptions that are not cancelled (<c>Active</c>, <c>Paused</c> or <c>Suspended</c>).</summary>
    Task<int> CountLiveAsync(Guid customerId, CancellationToken ct);

    /// <summary>The customer's live subscription to the SKU, if any (the unique index <c>ix_subscription_live_per_sku</c> allows one).</summary>
    Task<Guid?> FindLiveIdAsync(Guid customerId, Guid skuId, CancellationToken ct);

    /// <summary>Every subscription of the customer, cancelled or not, oldest first.</summary>
    Task<IReadOnlyList<Guid>> FindIdsByCustomerAsync(Guid customerId, CancellationToken ct);

    /// <summary>Every cycle of the customer, oldest first.</summary>
    Task<IReadOnlyList<Guid>> FindCycleIdsByCustomerAsync(Guid customerId, CancellationToken ct);

    /// <summary>The cycle of a subscription on a date, if one was recorded.</summary>
    Task<Guid?> FindCycleIdAsync(Guid subscriptionId, DateOnly cycleOn, CancellationToken ct);

    /// <summary>The latest <paramref name="take"/> cycles of a subscription processed after <paramref name="since"/> (a reinstatement restarts the streak), newest first, as the unpaid streak reads them.</summary>
    Task<IReadOnlyList<StreakCycle>> LatestCyclesAsync(Guid subscriptionId, int take, DateTimeOffset? since, CancellationToken ct);
}
