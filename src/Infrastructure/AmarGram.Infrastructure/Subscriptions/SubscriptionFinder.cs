using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Subscriptions;

/// <summary>HO-SUB-001 §11.4, §11.6 -- <see cref="ISubscriptionFinder"/>: ids and numbers only, oldest first, no aggregate is loaded.</summary>
public sealed class SubscriptionFinder(AmarGramDbContext db) : ISubscriptionFinder
{
    public Task<int> CountLiveAsync(Guid customerId, CancellationToken ct) =>
        db.Subscriptions.AsNoTracking().CountAsync(s => s.CustomerId == customerId && s.Status != SubscriptionStatus.Cancelled, ct);

    public async Task<Guid?> FindLiveIdAsync(Guid customerId, Guid skuId, CancellationToken ct) =>
        await db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == customerId && s.SkuId == skuId && s.Status != SubscriptionStatus.Cancelled)
            .Select(s => (Guid?)s.Id).FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<Guid>> FindIdsByCustomerAsync(Guid customerId, CancellationToken ct) =>
        await db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == customerId).OrderBy(s => s.StartedOn).ThenBy(s => s.Id).Select(s => s.Id).ToListAsync(ct);

    public async Task<IReadOnlyList<Guid>> FindCycleIdsByCustomerAsync(Guid customerId, CancellationToken ct) =>
        await db.SubscriptionCycles.AsNoTracking().Where(c => c.CustomerId == customerId).OrderBy(c => c.CycleOn).ThenBy(c => c.Id).Select(c => c.Id).ToListAsync(ct);

    public async Task<Guid?> FindCycleIdAsync(Guid subscriptionId, DateOnly cycleOn, CancellationToken ct) =>
        await db.SubscriptionCycles.AsNoTracking().Where(c => c.SubscriptionId == subscriptionId && c.CycleOn == cycleOn).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<StreakCycle>> LatestCyclesAsync(Guid subscriptionId, int take, DateTimeOffset? since, CancellationToken ct)
    {
        var rows = await db.SubscriptionCycles.AsNoTracking().Where(c => c.SubscriptionId == subscriptionId && (since == null || c.ProcessedOn > since))
            .OrderByDescending(c => c.CycleOn).Take(take).Select(c => new { c.Outcome, c.OrderState }).ToListAsync(ct);
        return rows.Select(r => new StreakCycle(r.Outcome, r.OrderState)).ToList();
    }
}
