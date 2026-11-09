using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Subscription;

/// <summary>Builds the staff rows (list, customer panel and CSV export share it): the subscription, its customer and product, and the derived unpaid streak.</summary>
internal static class StaffSubscriptionRows
{
    public static IQueryable<SubscriptionAggregate> Filter(
        AmarGramDbContext db, SubscriptionStatus? status, SubscriptionSuspensionReason? suspensionReason, SubscriptionPaymentMethod? paymentMethod, string? text, Guid? customerId,
        DateOnly? nextDeliveryOn = null)
    {
        var q = db.Subscriptions.AsNoTracking().AsQueryable();
        if (customerId is { } cid) q = q.Where(s => s.CustomerId == cid);
        if (status is not null) q = q.Where(s => s.Status == status);
        if (suspensionReason is not null) q = q.Where(s => s.SuspensionReason == suspensionReason);
        if (paymentMethod is not null) q = q.Where(s => s.Terms.PaymentMethod == paymentMethod);
        // "Due on a date" is the due-tomorrow count's own definition (GetSubscriptionDueTomorrowQueryHandler): Active and NextDeliveryOn on that commerce-zone date.
        if (nextDeliveryOn is { } due) q = q.Where(s => s.Status == SubscriptionStatus.Active && s.NextDeliveryOn == due);

        if (!string.IsNullOrWhiteSpace(text))
        {
            var term = text.Trim().ToLowerInvariant().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            q = q.Where(s => EF.Functions.Like(s.Product.ProductName.ToLower(), $"%{term}%")
                             || db.CustomerAccounts.Any(c => c.Id == s.CustomerId
                                                             && (EF.Functions.Like(c.FullName.ToLower(), $"%{term}%") || (c.MobileNumber != null && EF.Functions.Like(c.MobileNumber.Value, $"%{term}%")))));
        }

        return q;
    }

    public static IQueryable<SubscriptionAggregate> Sorted(IQueryable<SubscriptionAggregate> q, string? sort) => (sort ?? "nextDeliveryOn").ToLowerInvariant() switch
    {
        "-nextdeliveryon" => q.OrderByDescending(s => s.NextDeliveryOn).ThenBy(s => s.Id),
        "status" => q.OrderBy(s => s.Status.Value).ThenBy(s => s.NextDeliveryOn).ThenBy(s => s.Id),
        "product" => q.OrderBy(s => s.Product.ProductName).ThenBy(s => s.Id),
        _ => q.OrderBy(s => s.NextDeliveryOn == null).ThenBy(s => s.NextDeliveryOn).ThenBy(s => s.Id),
    };

    public static async Task<IReadOnlyList<StaffSubscriptionRowViewModel>> RowsAsync(
        AmarGramDbContext db, SubscriptionViews views, IReadOnlyList<SubscriptionAggregate> page)
    {
        if (page.Count == 0) return [];

        var built = await views.BuildAsync(page);
        var customers = await CustomersAsync(db, page.Select(s => s.CustomerId).Distinct().ToList());
        var streaks = await views.StreaksAsync(page);

        return page.Select((s, i) => new StaffSubscriptionRowViewModel(
            s.Id, customers.GetValueOrDefault(s.CustomerId) ?? new SubscriptionCustomerViewModel(s.CustomerId, "Customer", null), built[i].Product, s.Terms.Quantity, s.Terms.IntervalWeeks,
            s.Status.DisplayName, s.SuspensionReason?.DisplayName, s.NextDeliveryOn, s.Terms.PaymentMethod.DisplayName, streaks[s.Id], built[i].LastCycle)).ToList();
    }

    public static async Task<Dictionary<Guid, SubscriptionCustomerViewModel>> CustomersAsync(AmarGramDbContext db, IReadOnlyCollection<Guid> ids) =>
        (await db.CustomerAccounts.AsNoTracking().Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.FullName, Mobile = c.MobileNumber != null ? c.MobileNumber.Value : null }).ToListAsync())
        .ToDictionary(c => c.Id, c => new SubscriptionCustomerViewModel(c.Id, c.FullName, c.Mobile));
}

/// <summary>HO-SUB-001 §12.4 (<c>Subscriptions.View</c>) -- the staff list with filters, sort and paging.</summary>
public sealed class GetStaffSubscriptionsQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetStaffSubscriptionsQuery, PagedResult<StaffSubscriptionRowViewModel>>
{
    public async Task<QueryResponse<PagedResult<StaffSubscriptionRowViewModel>>> HandleAsync(GetStaffSubscriptionsQuery query)
    {
        var (pageNumber, pageSize) = SubscriptionPaging.Of(query.PageNumber, query.PageSize);
        var rows = StaffSubscriptionRows.Filter(db, query.Status, query.SuspensionReason, query.PaymentMethod, query.Text, query.CustomerId, query.NextDeliveryOn);

        var total = await rows.CountAsync();
        var page = await StaffSubscriptionRows.Sorted(rows, query.Sort).Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync();

        return new QueryResponse<PagedResult<StaffSubscriptionRowViewModel>>
        {
            Result = new PagedResult<StaffSubscriptionRowViewModel>(await StaffSubscriptionRows.RowsAsync(db, views, page), pageNumber, pageSize, total),
        };
    }
}

/// <summary>HO-SUB-001 §12.4 -- the CSV export's rows: the list's filters, every match up to <see cref="SubscriptionRules.MaxExportRows"/> + 1 (the caller answers
/// <c>413</c> above the cap), in pages so the working set stays small.</summary>
public sealed class ExportSubscriptionsQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<ExportSubscriptionsQuery, IReadOnlyList<StaffSubscriptionRowViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<StaffSubscriptionRowViewModel>>> HandleAsync(ExportSubscriptionsQuery query)
    {
        var sorted = StaffSubscriptionRows.Sorted(
            StaffSubscriptionRows.Filter(db, query.Status, query.SuspensionReason, query.PaymentMethod, query.Text, null, query.NextDeliveryOn), query.Sort);

        var result = new List<StaffSubscriptionRowViewModel>();
        const int batch = 500;
        for (var skip = 0; skip <= SubscriptionRules.MaxExportRows; skip += batch)
        {
            var page = await sorted.Skip(skip).Take(Math.Min(batch, SubscriptionRules.MaxExportRows + 1 - skip)).ToListAsync();
            if (page.Count == 0) break;

            result.AddRange(await StaffSubscriptionRows.RowsAsync(db, views, page));
            if (page.Count < batch) break;
        }

        return new QueryResponse<IReadOnlyList<StaffSubscriptionRowViewModel>> { Result = result };
    }
}

/// <summary>
/// HO-SUB-001 §12.4 (US-SUB-06 AC2) -- the unpaid-subscriptions worklist: <c>Suspended</c> for unpaid cycles (group <c>Suspended</c>), and <c>Active</c> ones at risk
/// (an unpaid streak of at least one, or a cycle still awaiting payment; group <c>AtRisk</c>). Each carries its streak and its unpaid cycles. A worklist is small by
/// nature, so it is assembled in memory from the candidate rows and then paged.
/// </summary>
public sealed class GetUnpaidSubscriptionsQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetUnpaidSubscriptionsQuery, PagedResult<UnpaidSubscriptionViewModel>>
{
    public async Task<QueryResponse<PagedResult<UnpaidSubscriptionViewModel>>> HandleAsync(GetUnpaidSubscriptionsQuery query)
    {
        var (pageNumber, pageSize) = SubscriptionPaging.Of(query.PageNumber, query.PageSize);

        var candidates = await db.Subscriptions.AsNoTracking()
            .Where(s => (s.Status == SubscriptionStatus.Suspended && s.SuspensionReason == SubscriptionSuspensionReason.UnpaidCycles)
                        || (s.Status == SubscriptionStatus.Active
                            && db.SubscriptionCycles.Any(c => c.SubscriptionId == s.Id
                                && (c.OrderState == SubscriptionCycleOrderState.AwaitingPayment || c.OrderState == SubscriptionCycleOrderState.Expired || c.OrderState == SubscriptionCycleOrderState.Refused))))
            .OrderBy(s => s.Id).ToListAsync();

        var (streaks, cycles) = await views.StreaksWithCyclesAsync(candidates);

        var kept = candidates
            .Select(s => new
            {
                Subscription = s,
                Streak = streaks[s.Id],
                Cycles = cycles.GetValueOrDefault(s.Id) ?? [],
            })
            .Where(x => x.Subscription.Status == SubscriptionStatus.Suspended
                        || x.Streak >= 1 || x.Cycles.Any(c => c.OrderState == SubscriptionCycleOrderState.AwaitingPayment))
            .OrderBy(x => x.Subscription.Status == SubscriptionStatus.Suspended ? 0 : 1).ThenByDescending(x => x.Streak).ThenBy(x => x.Subscription.Id)
            .ToList();

        var pageItems = kept.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        var built = await views.BuildAsync(pageItems.Select(x => x.Subscription).ToList());
        var customers = await StaffSubscriptionRows.CustomersAsync(db, pageItems.Select(x => x.Subscription.CustomerId).Distinct().ToList());

        var items = pageItems.Select((x, i) => new UnpaidSubscriptionViewModel(
            x.Subscription.Id, customers.GetValueOrDefault(x.Subscription.CustomerId) ?? new SubscriptionCustomerViewModel(x.Subscription.CustomerId, "Customer", null), built[i].Product,
            x.Subscription.Status.DisplayName, x.Subscription.Status == SubscriptionStatus.Suspended ? "Suspended" : "AtRisk", x.Streak,
            x.Cycles.Where(c => c.OrderState == SubscriptionCycleOrderState.AwaitingPayment || UnpaidCycleRule.IsUnpaid(c.OrderState)).Select(SubscriptionViews.CycleOf).ToList())).ToList();

        return new QueryResponse<PagedResult<UnpaidSubscriptionViewModel>> { Result = new PagedResult<UnpaidSubscriptionViewModel>(items, pageNumber, pageSize, kept.Count) };
    }
}

/// <summary>HO-SUB-001 §12.4 -- one subscription for staff, with its customer, the latest 50 cycles, the cancellation and reinstatement facts and the staff actions allowed.</summary>
public sealed class GetStaffSubscriptionDetailQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetStaffSubscriptionDetailQuery, StaffSubscriptionDetailViewModel?>
{
    public async Task<QueryResponse<StaffSubscriptionDetailViewModel?>> HandleAsync(GetStaffSubscriptionDetailQuery query)
    {
        var subscription = await db.Subscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == query.SubscriptionId);
        if (subscription is null) return new QueryResponse<StaffSubscriptionDetailViewModel?> { Result = null };

        var view = (await views.BuildAsync([subscription]))[0];
        var customers = await StaffSubscriptionRows.CustomersAsync(db, [subscription.CustomerId]);
        var cycles = await views.CyclesAsync(subscription.Id, 50);

        var actions = new List<string>();
        if (subscription.Status == SubscriptionStatus.Suspended) actions.Add("Reinstate");
        if (subscription.Status != SubscriptionStatus.Cancelled) actions.Add("Cancel");

        var reinstatement = subscription.ReinstatedOn is { } on && subscription.ReinstatedBy is { } by
            ? new StaffReinstatementViewModel(on, by, subscription.ReinstatementReason ?? string.Empty)
            : null;

        return new QueryResponse<StaffSubscriptionDetailViewModel?>
        {
            Result = new StaffSubscriptionDetailViewModel(
                view, customers.GetValueOrDefault(subscription.CustomerId) ?? new SubscriptionCustomerViewModel(subscription.CustomerId, "Customer", null), cycles,
                subscription.CancellationReason?.DisplayName, subscription.CancellationNote, subscription.SuspendedOn, reinstatement, actions),
        };
    }
}

/// <summary>HO-SUB-001 §12.4 (HO-P4 customer "Subscriptions" tab) -- the customer-page panel: their non-cancelled subscriptions, and the cancelled and suspended counts.</summary>
public sealed class GetCustomerSubscriptionSummaryQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetCustomerSubscriptionSummaryQuery, CustomerSubscriptionSummaryViewModel>
{
    public async Task<QueryResponse<CustomerSubscriptionSummaryViewModel>> HandleAsync(GetCustomerSubscriptionSummaryQuery query)
    {
        var mine = db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == query.CustomerId);
        var live = await mine.Where(s => s.Status != SubscriptionStatus.Cancelled).OrderBy(s => s.NextDeliveryOn == null).ThenBy(s => s.NextDeliveryOn).ThenBy(s => s.Id).ToListAsync();
        var cancelled = await mine.CountAsync(s => s.Status == SubscriptionStatus.Cancelled);

        return new QueryResponse<CustomerSubscriptionSummaryViewModel>
        {
            Result = new CustomerSubscriptionSummaryViewModel(await views.BuildAsync(live), cancelled, live.Count(s => s.Status == SubscriptionStatus.Suspended)),
        };
    }
}

/// <summary>HO-SUB-001 (BG-15) -- the dashboard's "Subscription orders due tomorrow": Active subscriptions whose next order is raised tomorrow in the commerce zone
/// (the same "due on a date" rule as the staff list's <c>nextDeliveryOn</c> filter), with the live and suspended counts for context.</summary>
public sealed class GetSubscriptionDueTomorrowQueryHandler(AmarGramDbContext db, ICommerceClock commerceClock)
    : IQueryHandlerAsync<GetSubscriptionDueTomorrowQuery, SubscriptionDueTomorrowViewModel>
{
    public async Task<QueryResponse<SubscriptionDueTomorrowViewModel>> HandleAsync(GetSubscriptionDueTomorrowQuery query)
    {
        var clock = await commerceClock.GetAsync();
        var tomorrow = clock.Today.AddDays(1);

        var count = await db.Subscriptions.AsNoTracking().CountAsync(s => s.Status == SubscriptionStatus.Active && s.NextDeliveryOn == tomorrow);
        var live = await db.Subscriptions.AsNoTracking().CountAsync(s => s.Status != SubscriptionStatus.Cancelled);
        var suspended = await db.Subscriptions.AsNoTracking().CountAsync(s => s.Status == SubscriptionStatus.Suspended);

        return new QueryResponse<SubscriptionDueTomorrowViewModel> { Result = new SubscriptionDueTomorrowViewModel(tomorrow, count, live, suspended, clock.ZoneId) };
    }
}
