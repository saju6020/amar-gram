using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.QueryHandlers.Product;
using AmarGram.Read.QueryHandlers.StoredFile;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Read.QueryHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §12.4, §12.6 -- builds <see cref="SubscriptionViewModel"/> for a set of subscriptions in a fixed handful of queries. The rules a screen shows
/// (<c>allowedActions</c>, <c>isLocked</c>, <c>skippableCycleOn</c>, <c>followingDeliveryOn</c>) come from <see cref="SubscriptionSchedule"/> -- <b>the same
/// function the aggregate applies</b> -- so a screen can never offer what the server would refuse. The subscriptions arrive as read-only (<c>AsNoTracking</c>)
/// rows: a subscription is one small row with two owned value objects, and the schedule's rules need all of it. Product names and prices are the catalogue's
/// current ones with the creation snapshot as the fallback; an address that has left the address book is <c>deliveryAddressMissing</c>.
/// </summary>
public sealed class SubscriptionViews(
    AmarGramDbContext db, ISubscribableCatalogue catalogue, ICommerceClock commerceClock, IBusinessSettings settings, IStoredFileSigningBatcher signer)
{
    public async Task<IReadOnlyList<SubscriptionViewModel>> BuildAsync(IReadOnlyList<SubscriptionAggregate> subscriptions, CancellationToken ct = default)
    {
        if (subscriptions.Count == 0) return [];

        var clock = await commerceClock.GetAsync(ct);
        var skuIds = subscriptions.Select(s => s.SkuId).Distinct().ToList();
        var skus = await catalogue.GetAsync(skuIds, clock.Now, ct);
        var images = await ProductImageUrls.ForSkusAsync(db, signer, skuIds);
        var addresses = await AddressesAsync(subscriptions, ct);
        var branches = await BranchesAsync(subscriptions, ct);
        var lastCycles = await LastCyclesAsync(subscriptions.Select(s => s.Id).ToList(), ct);
        var currency = settings.GetString(SettingKeys.CommerceCurrencyCode);
        var discount = settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent);

        return subscriptions.Select(s => ViewOf(s, clock, skus, images, addresses, branches, lastCycles, currency, discount)).ToList();
    }

    private static SubscriptionViewModel ViewOf(
        SubscriptionAggregate s, SubscriptionClock clock, IReadOnlyDictionary<Guid, SubscribableSkuFacts> skus, IReadOnlyDictionary<Guid, string> images,
        Dictionary<(Guid, Guid), SubscriptionAddressViewModel> addresses, Dictionary<Guid, string> branches,
        Dictionary<Guid, SubscriptionCycleViewModel> lastCycles, string currency, decimal discount)
    {
        var state = s.ToScheduleState();
        skus.TryGetValue(s.SkuId, out var sku);

        var product = new SubscriptionProductViewModel(
            s.SkuId, sku?.ProductName ?? s.Product.ProductName, sku?.VariantLabel ?? s.Product.VariantLabel, images.GetValueOrDefault(s.SkuId), sku?.IsPurchasable ?? false);

        SubscriptionEstimateViewModel? estimate = null;
        if (sku is { UnitPrice: { } price })
        {
            var e = SubscriptionEstimate.Compute(price, s.Terms.Quantity, discount);
            var code = sku.CurrencyCode ?? currency;
            estimate = new SubscriptionEstimateViewModel(
                OrderMoney.Of(e.UnitPrice, code), e.Quantity, OrderMoney.Of(e.Subtotal, code), e.DiscountPercent.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                OrderMoney.Of(e.DiscountAmount, code), OrderMoney.Of(e.EstimatedTotal, code), SubscriptionMessages.EstimateNote);
        }

        SubscriptionPendingViewModel? pending = null;
        if (s.PendingTerms is not null || s.PendingSkip || s.PendingStatusChange is not null)
        {
            var appliesFrom = s.PendingStatusChange == SubscriptionPendingStatusChange.Cancel ? s.NextDeliveryOn : SubscriptionSchedule.FollowingCycleOn(state);
            pending = new SubscriptionPendingViewModel(
                s.PendingTerms is null ? null : TermsOf(s.CustomerId, s.PendingTerms, addresses, branches), s.PendingSkip, s.PendingStatusChange?.DisplayName, appliesFrom);
        }

        return new SubscriptionViewModel(
            s.Id, s.Version, s.Status.DisplayName, s.SuspensionReason?.DisplayName, product, TermsOf(s.CustomerId, s.Terms, addresses, branches), s.NextDeliveryOn,
            s.Status == SubscriptionStatus.Active && s.NextDeliveryOn is { } next ? clock.CutoffInstant(next) : null, SubscriptionSchedule.IsLocked(state, clock),
            s.Status == SubscriptionStatus.Active ? SubscriptionSchedule.FollowingCycleOn(state) : null, SubscriptionSchedule.SkippableCycleOn(state, clock), pending, estimate,
            SubscriptionSchedule.AllowedActions(state, clock), lastCycles.GetValueOrDefault(s.Id), s.StartedOn, s.CancelledOn, clock.ZoneId);
    }

    private static SubscriptionTermsViewModel TermsOf(
        Guid customerId, SubscriptionTerms t, Dictionary<(Guid, Guid), SubscriptionAddressViewModel> addresses, Dictionary<Guid, string> branches)
    {
        SubscriptionAddressViewModel? address = null;
        var missing = false;
        if (t.DeliveryAddressId is { } addressId)
        {
            if (addresses.TryGetValue((customerId, addressId), out var found)) address = found;
            else missing = true;
        }

        var branch = t.PickupBranchId is { } branchId && branches.TryGetValue(branchId, out var name) ? new SubscriptionBranchViewModel(branchId, name) : null;
        return new SubscriptionTermsViewModel(t.Quantity, t.IntervalWeeks, t.Fulfilment.DisplayName, address, missing, branch, t.PaymentMethod.DisplayName);
    }

    private async Task<Dictionary<(Guid, Guid), SubscriptionAddressViewModel>> AddressesAsync(IReadOnlyList<SubscriptionAggregate> subscriptions, CancellationToken ct)
    {
        var customerIds = subscriptions.Where(s => s.Terms.DeliveryAddressId is not null || s.PendingTerms?.DeliveryAddressId is not null).Select(s => s.CustomerId).Distinct().ToList();
        if (customerIds.Count == 0) return [];

        var rows = await db.CustomerAddressBooks.AsNoTracking().Where(b => customerIds.Contains(b.Id))
            .SelectMany(b => b.Addresses.Select(a => new { CustomerId = b.Id, a.Id, a.Label, a.Line1, a.City }))
            .ToListAsync(ct);
        return rows.ToDictionary(r => (r.CustomerId, r.Id), r => new SubscriptionAddressViewModel(r.Id, r.Label, r.Line1, r.City));
    }

    private async Task<Dictionary<Guid, string>> BranchesAsync(IReadOnlyList<SubscriptionAggregate> subscriptions, CancellationToken ct)
    {
        var ids = subscriptions.SelectMany(s => new[] { s.Terms.PickupBranchId, s.PendingTerms?.PickupBranchId }).Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        return await db.Set<BranchAggregate>().AsNoTracking().Where(b => ids.Contains(b.Id)).Select(b => new { b.Id, b.Name }).ToDictionaryAsync(b => b.Id, b => b.Name, ct);
    }

    private async Task<Dictionary<Guid, SubscriptionCycleViewModel>> LastCyclesAsync(IReadOnlyList<Guid> subscriptionIds, CancellationToken ct)
    {
        var rows = await db.SubscriptionCycles.AsNoTracking()
            .Where(c => subscriptionIds.Contains(c.SubscriptionId)
                        && c.CycleOn == db.SubscriptionCycles.Where(x => x.SubscriptionId == c.SubscriptionId).Max(x => x.CycleOn))
            .ToListAsync(ct);
        return rows.GroupBy(c => c.SubscriptionId).ToDictionary(g => g.Key, g => CycleOf(g.First()));
    }

    public static SubscriptionCycleViewModel CycleOf(SubscriptionCycleAggregate c) =>
        new(c.Id, c.CycleOn, c.Outcome.DisplayName, c.FailureReason?.DisplayName, c.OrderId, c.OrderNumber, c.OrderState?.DisplayName, c.PaymentExpiresOn,
            c.DiscountPercent.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));

    /// <summary>The latest cycles of one subscription, newest first.</summary>
    public async Task<IReadOnlyList<SubscriptionCycleViewModel>> CyclesAsync(Guid subscriptionId, int take, CancellationToken ct = default) =>
        (await db.SubscriptionCycles.AsNoTracking().Where(c => c.SubscriptionId == subscriptionId).OrderByDescending(c => c.CycleOn).Take(take).ToListAsync(ct)).Select(CycleOf).ToList();

    /// <summary>The unpaid streak of each subscription from its latest cycles (only those processed after a reinstatement), by <see cref="UnpaidCycleRule"/>.</summary>
    public async Task<Dictionary<Guid, int>> StreaksAsync(IReadOnlyList<SubscriptionAggregate> subscriptions, CancellationToken ct = default)
    {
        var (streaks, _) = await StreaksWithCyclesAsync(subscriptions, ct);
        return streaks;
    }

    public async Task<(Dictionary<Guid, int> Streaks, Dictionary<Guid, List<SubscriptionCycleAggregate>> Cycles)> StreaksWithCyclesAsync(
        IReadOnlyList<SubscriptionAggregate> subscriptions, CancellationToken ct = default)
    {
        var ids = subscriptions.Select(s => s.Id).ToList();
        var rows = ids.Count == 0
            ? []
            : await db.SubscriptionCycles.AsNoTracking()
                .Where(c => ids.Contains(c.SubscriptionId)
                            && db.SubscriptionCycles.Count(x => x.SubscriptionId == c.SubscriptionId && x.CycleOn > c.CycleOn) < SubscriptionRules.StreakWindow)
                .ToListAsync(ct);

        var bySubscription = rows.GroupBy(c => c.SubscriptionId).ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.CycleOn).ToList());
        var streaks = subscriptions.ToDictionary(
            s => s.Id,
            s => bySubscription.TryGetValue(s.Id, out var cycles)
                ? UnpaidCycleRule.Streak(cycles.Where(c => s.ReinstatedOn is null || c.ProcessedOn > s.ReinstatedOn).Select(c => new StreakCycle(c.Outcome, c.OrderState)))
                : 0);
        return (streaks, bySubscription);
    }
}
