using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Subscriptions;

/// <summary>
/// HO-SUB-001 §8.13, OQ-15 (ADR-239) -- <see cref="ICommerceClock"/>: the <b>main branch's</b> IANA zone (subscriptions are not branch-scoped, so one zone
/// governs all of them) and <c>subscription.changeCutoffDays</c>, at the instant <c>TimeProvider</c> reports. The only code in the slice that reads the zone.
/// </summary>
public sealed class CommerceClock(AmarGramDbContext db, IBusinessSettings settings, TimeProvider timeProvider) : ICommerceClock
{
    public Task<SubscriptionClock> GetAsync(CancellationToken ct = default) => GetAtAsync(timeProvider.GetUtcNow(), ct);

    public async Task<SubscriptionClock> GetAtAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        var zoneId = await db.Set<BranchAggregate>().AsNoTracking().Where(b => b.Id == AdministrationSeed.MainBranchId).Select(b => b.TimeZoneId).FirstOrDefaultAsync(ct) ?? "UTC";
        return SubscriptionClock.Create(now, TimeZoneInfo.FindSystemTimeZoneById(zoneId), settings.GetInt(SettingKeys.SubscriptionChangeCutoffDays));
    }
}
