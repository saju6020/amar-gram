using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §12.2 pass 2 (ADR-243) -- <c>Active</c> subscriptions whose derived unpaid streak has reached the threshold. This only <i>nominates</i>: the suspend
/// command re-evaluates the rule before it writes. Cheap pre-filter in SQL (at least <c>threshold</c> unpaid cycles exist), exact rule in memory.
/// </summary>
public sealed class GetUnpaidSuspensionCandidatesQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetUnpaidSuspensionCandidatesQuery, IReadOnlyList<Guid>>
{
    public async Task<QueryResponse<IReadOnlyList<Guid>>> HandleAsync(GetUnpaidSuspensionCandidatesQuery query)
    {
        var threshold = Math.Max(query.Threshold, 1);
        var pool = db.Subscriptions.AsNoTracking().Where(s => s.Status == SubscriptionStatus.Active);
        if (query.CustomerId is { } only) pool = pool.Where(s => s.CustomerId == only);

        var candidates = await pool
            .Where(s => db.SubscriptionCycles.Count(c => c.SubscriptionId == s.Id && (c.OrderState == SubscriptionCycleOrderState.Expired || c.OrderState == SubscriptionCycleOrderState.Refused)) >= threshold)
            .OrderBy(s => s.NextDeliveryOn).ThenBy(s => s.Id).Take(query.Take).ToListAsync();

        var streaks = await views.StreaksAsync(candidates);
        IReadOnlyList<Guid> ids = candidates.Where(s => streaks[s.Id] >= threshold).Select(s => s.Id).ToList();
        return new QueryResponse<IReadOnlyList<Guid>> { Result = ids };
    }
}

/// <summary>
/// HO-SUB-001 §8.8 (ADR-245) -- the pre-charge notice pass: <c>Active</c> subscriptions whose notice date (<c>cycle - max(noticeDays, cutoffDays + 1)</c>) has come
/// and whose delivery has not, and whose date was <b>not</b> chosen by the customer on or after the notice date (they were just shown it).
/// </summary>
public sealed class GetPreChargeNoticeCandidatesQueryHandler(AmarGramDbContext db, ICommerceClock commerceClock, ISubscribableCatalogue catalogue, IBusinessSettings settings)
    : IQueryHandlerAsync<GetPreChargeNoticeCandidatesQuery, IReadOnlyList<PreChargeNoticeCandidate>>
{
    public async Task<QueryResponse<IReadOnlyList<PreChargeNoticeCandidate>>> HandleAsync(GetPreChargeNoticeCandidatesQuery query)
    {
        var clock = await commerceClock.GetAsync();
        var lead = Math.Max(settings.GetInt(SettingKeys.SubscriptionPreChargeNoticeDays), clock.CutoffDays + 1);
        var today = clock.Today;
        var horizon = today.AddDays(lead);

        var pool = db.Subscriptions.AsNoTracking().Where(s => s.Status == SubscriptionStatus.Active && s.NextDeliveryOn > today && s.NextDeliveryOn <= horizon);
        if (query.CustomerId is { } only) pool = pool.Where(s => s.CustomerId == only);

        var due = await pool
            .OrderBy(s => s.NextDeliveryOn).ThenBy(s => s.Id).Take(query.Take * 2).ToListAsync();

        // Suppress a notice the person has just been shown: NextDeliverySetOn on or after the notice date means the create/change/resume response named it.
        var eligible = due
            .Where(s => s.NextDeliverySetOn is null || s.NextDeliverySetOn < SubscriptionSchedule.NoticeDateFor(s.NextDeliveryOn!.Value, settings.GetInt(SettingKeys.SubscriptionPreChargeNoticeDays), clock.CutoffDays))
            .Take(query.Take).ToList();

        var skus = await catalogue.GetAsync(eligible.Select(s => s.SkuId).Distinct().ToList(), clock.Now, default);
        var discount = settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent);
        var currency = settings.GetString(SettingKeys.CommerceCurrencyCode);

        IReadOnlyList<PreChargeNoticeCandidate> result = eligible.Select(s =>
        {
            skus.TryGetValue(s.SkuId, out var sku);
            var estimate = sku?.UnitPrice is { } price
                ? BillingMessages.FormatMoney(SubscriptionEstimate.Compute(price, s.Terms.Quantity, discount).EstimatedTotal, sku.CurrencyCode ?? currency)
                : "to be confirmed";
            return new PreChargeNoticeCandidate(
                s.Id, s.CustomerId, s.NextDeliveryOn!.Value, sku?.ProductName ?? s.Product.ProductName, s.Terms.Quantity, SubscriptionMessages.PaymentMethodText(s.Terms.PaymentMethod), estimate);
        }).ToList();

        return new QueryResponse<IReadOnlyList<PreChargeNoticeCandidate>> { Result = result };
    }
}

/// <summary>HO-SUB-001 §12.2 pass 4 (ADR-249) -- <c>Active</c> subscriptions due on or before today, oldest first, bounded so a backlog after downtime drains over several passes.</summary>
public sealed class GetDueSubscriptionCyclesQueryHandler(AmarGramDbContext db, ICommerceClock commerceClock)
    : IQueryHandlerAsync<GetDueSubscriptionCyclesQuery, IReadOnlyList<DueSubscriptionCycle>>
{
    public async Task<QueryResponse<IReadOnlyList<DueSubscriptionCycle>>> HandleAsync(GetDueSubscriptionCyclesQuery query)
    {
        var today = (await commerceClock.GetAsync()).Today;
        var rows = db.Subscriptions.AsNoTracking().Where(s => s.Status == SubscriptionStatus.Active && s.NextDeliveryOn <= today);
        if (query.CustomerId is { } customerId) rows = rows.Where(s => s.CustomerId == customerId);

        var due = await rows.OrderBy(s => s.NextDeliveryOn).ThenBy(s => s.Id).Take(query.Take).Select(s => new { s.Id, s.NextDeliveryOn }).ToListAsync();
        IReadOnlyList<DueSubscriptionCycle> result = due.Select(d => new DueSubscriptionCycle(d.Id, d.NextDeliveryOn!.Value)).ToList();
        return new QueryResponse<IReadOnlyList<DueSubscriptionCycle>> { Result = result };
    }
}

/// <summary>HO-SUB-001 §12.2 pass 4 scope 1 -- builds the request for one due cycle, or <c>null</c> when the subscription is no longer due on that date (it changed since the
/// pass queried: the pass skips it). The discount is the setting <b>now</b>, passed to Orders and snapshotted on the cycle (ADR-242).</summary>
public sealed class GetSubscriptionOrderRequestQueryHandler(AmarGramDbContext db, IBusinessSettings settings)
    : IQueryHandlerAsync<GetSubscriptionOrderRequestQuery, SubscriptionOrderRequest?>
{
    public async Task<QueryResponse<SubscriptionOrderRequest?>> HandleAsync(GetSubscriptionOrderRequestQuery query)
    {
        var s = await db.Subscriptions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.SubscriptionId);
        if (s is null || s.Status != SubscriptionStatus.Active || s.NextDeliveryOn != query.CycleOn)
            return new QueryResponse<SubscriptionOrderRequest?> { Result = null };

        return new QueryResponse<SubscriptionOrderRequest?>
        {
            Result = new SubscriptionOrderRequest(
                s.Id, s.CustomerId, s.SkuId, query.CycleOn, s.Terms.Quantity, s.Terms.Fulfilment, s.Terms.DeliveryAddressId, s.Terms.PickupBranchId, s.Terms.PaymentMethod,
                settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent), SubscriptionKeys.IdempotencyKey(s.Id, query.CycleOn)),
        };
    }
}
