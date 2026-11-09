using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Billing;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Billing;

internal static class BillingClock
{
    /// <summary>The branch-local date -- never the server's (ADR-045). With no branch, the default zone.</summary>
    public static async Task<DateOnly> LocalTodayAsync(AmarGramDbContext db, TimeProvider timeProvider, Guid? branchId)
    {
        var timeZoneId = branchId is { } id
            ? await db.Set<BranchAggregate>().AsNoTracking().Where(b => b.Id == id).Select(b => b.TimeZoneId).FirstOrDefaultAsync()
            : null;

        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId ?? BillingRules.DefaultTimeZoneId);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), zone).DateTime);
    }
}

/// <summary>HO-BIL-001 §12.4 (US-BIL-03 AC1) -- the customer's money position.</summary>
public sealed class GetCustomerBillingSummaryQueryHandler(AmarGramDbContext db, IBusinessSettings settings, TimeProvider timeProvider)
    : IQueryHandlerAsync<GetCustomerBillingSummaryQuery, CustomerBillingSummaryViewModel>
{
    public async Task<QueryResponse<CustomerBillingSummaryViewModel>> HandleAsync(GetCustomerBillingSummaryQuery query)
    {
        var currency = settings.GetString(SettingKeys.CommerceCurrencyCode);
        var today = await BillingClock.LocalTodayAsync(db, timeProvider, query.BranchId);
        var customers = CustomerSet.Of(db, query.CustomerId);

        var open = await db.Set<InvoiceAggregate>().AsNoTracking()
            .Where(i => customers.Contains(i.CustomerId) && (i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartPaid))
            .Select(i => new { i.Total, i.PaidTotal, i.CreditedTotal, i.DueOn })
            .ToListAsync();

        var outstanding = open.Sum(i => InvoiceStatusRules.Outstanding(i.Total, i.PaidTotal, i.CreditedTotal));
        var overdue = open.Where(i => i.DueOn < today).Sum(i => InvoiceStatusRules.Outstanding(i.Total, i.PaidTotal, i.CreditedTotal));
        DateOnly? oldestDue = open.Where(i => i.DueOn is not null && InvoiceStatusRules.Outstanding(i.Total, i.PaidTotal, i.CreditedTotal) > 0m).Select(i => i.DueOn).Min();

        var credits = await db.Set<PaymentAggregate>().AsNoTracking()
            .Where(p => customers.Contains(p.CustomerId) && p.Status == PaymentStatus.Accepted)
            .Select(p => new
            {
                p.Id, EarmarkLabel = p.Earmark != null ? p.Earmark.Label : null, EarmarkReleased = p.Earmark != null && p.Earmark.ReleasedOn != null,
                HasEarmark = p.Earmark != null,
                Unallocated = p.Amount
                    - p.Entries.Where(e => e.Kind == AllocationEntryKind.Allocate).Sum(e => e.Amount)
                    + p.Entries.Where(e => e.Kind == AllocationEntryKind.Release).Sum(e => e.Amount)
                    - p.RefundedTotal,
            })
            .ToListAsync();

        var free = credits.Where(c => !c.HasEarmark || c.EarmarkReleased).Sum(c => c.Unallocated);
        var earmarked = credits.Where(c => c.HasEarmark && !c.EarmarkReleased && c.Unallocated > 0m)
            .Select(c => new EarmarkedCreditViewModel(c.Id, c.EarmarkLabel ?? string.Empty, BillingMoney.Of(c.Unallocated, currency))).ToList();

        var unbilledRows = await db.Charges.AsNoTracking()
            .Where(c => customers.Contains(c.CustomerId) && c.Status == ChargeStatus.Active
                        && !db.Set<InvoiceAggregate>().Any(i => i.Status != InvoiceStatus.Discarded && i.Lines.Any(l => l.ChargeId == c.Id)))
            .Select(c => new { c.Quantity, c.UnitPriceAmount, c.LineDiscountAmount })
            .ToListAsync();
        var unbilled = unbilledRows.Sum(c => InvoiceCalculator.Round(c.Quantity * c.UnitPriceAmount) - c.LineDiscountAmount);

        var loyaltyEnabled = settings.GetBool(SettingKeys.BillingLoyaltyEnabled);
        var loyaltyPoints = loyaltyEnabled ? await LoyaltyBalanceLookup.ForCustomerAsync(db, query.CustomerId) : null;

        var result = new CustomerBillingSummaryViewModel(
            BillingMoney.Of(outstanding, currency), BillingMoney.Of(overdue, currency), BillingMoney.Of(free, currency), earmarked,
            BillingMoney.Of(unbilled, currency), loyaltyPoints, loyaltyEnabled, oldestDue);

        return new QueryResponse<CustomerBillingSummaryViewModel> { Result = result };
    }
}

/// <summary>A customer's loyalty points balance (the account row is the cached total of the ledger).</summary>
internal static class LoyaltyBalanceLookup
{
    public static async Task<int> BalanceAsync(AmarGramDbContext db, Guid customerId) =>
        await db.Set<AmarGram.Domain.Aggregates.Billing.LoyaltyAccountAggregate>().AsNoTracking().Where(a => a.Id == customerId).Select(a => (int?)a.Balance).FirstOrDefaultAsync() ?? 0;

    public static async Task<int?> ForCustomerAsync(AmarGramDbContext db, Guid customerId) => await BalanceAsync(db, customerId);
}

/// <summary>HO-BIL-001 §12.4 (US-BIL-03 AC2) -- outstanding per issued invoice in SQL, bucketed by <c>AgeingCalculator</c>
/// (pure) against <c>asOf</c> (branch-local today by default).</summary>
public sealed class GetAgeingQueryHandler(AmarGramDbContext db, IBusinessSettings settings, TimeProvider timeProvider)
    : IQueryHandlerAsync<GetAgeingQuery, AgeingViewModel>
{
    public async Task<QueryResponse<AgeingViewModel>> HandleAsync(GetAgeingQuery query)
    {
        var currency = settings.GetString(SettingKeys.CommerceCurrencyCode);
        var asOf = query.AsOf ?? await BillingClock.LocalTodayAsync(db, timeProvider, query.BranchId);
        var pageSize = Math.Clamp(query.PageSize <= 0 ? 50 : query.PageSize, 1, 200);
        var pageNumber = Math.Max(query.PageNumber, 1);

        var invoices = db.Set<InvoiceAggregate>().AsNoTracking()
            .Where(i => i.BranchId == query.BranchId && (i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartPaid) && i.DueOn != null);
        if (query.CustomerId is { } customerId) invoices = invoices.Where(i => i.CustomerId == customerId);

        var rows = await invoices
            .Select(i => new { i.CustomerId, i.Id, DueOn = i.DueOn!.Value, Outstanding = i.Total - i.CreditedTotal - i.PaidTotal })
            .Where(i => i.Outstanding > 0m)
            .ToListAsync();

        var inputs = rows.Select(r => new AgeingInput(r.CustomerId, r.Id, r.DueOn, r.Outstanding)).ToList();
        var totals = AgeingCalculator.Totals(inputs, asOf);
        var byCustomer = AgeingCalculator.ByCustomer(inputs, asOf);

        var page = byCustomer.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        var ids = page.Select(r => r.CustomerId).ToList();
        var names = (await db.Set<CustomerAccountAggregate>().AsNoTracking().Where(c => ids.Contains(c.Id)).Select(c => new { c.Id, c.FullName }).ToListAsync())
            .ToDictionary(c => c.Id, c => c.FullName);

        MoneyViewModel M(decimal amount) => BillingMoney.Of(amount, currency);
        var viewRows = page.Select(r => new AgeingRowViewModel(
            r.CustomerId, names.GetValueOrDefault(r.CustomerId, ""), M(r.Buckets.Current), M(r.Buckets.Days1To30), M(r.Buckets.Days31To60), M(r.Buckets.Days61To90),
            M(r.Buckets.Over90), M(r.Buckets.Total), r.OldestDueOn)).ToList();

        var result = new AgeingViewModel(
            asOf, new AgeingTotalsViewModel(M(totals.Current), M(totals.Days1To30), M(totals.Days31To60), M(totals.Days61To90), M(totals.Over90)),
            new PagedResult<AgeingRowViewModel>(viewRows, pageNumber, pageSize, byCustomer.Count));

        return new QueryResponse<AgeingViewModel> { Result = result };
    }
}

/// <summary>HO-BIL-001 §8.13 -- the published per-source status (an order).</summary>
public sealed class GetSourceBillingStatusQueryHandler(AmarGramDbContext db, IBusinessSettings settings)
    : IQueryHandlerAsync<GetSourceBillingStatusQuery, SourceBillingStatusViewModel>
{
    public async Task<QueryResponse<SourceBillingStatusViewModel>> HandleAsync(GetSourceBillingStatusQuery query)
    {
        var currency = settings.GetString(SettingKeys.CommerceCurrencyCode);
        var kind = EnumerationParsing.TryParse<ChargeSourceKind>(query.Kind, out var parsed) && parsed is not null ? parsed : null;

        var charges = kind is null ? [] : await db.Charges.AsNoTracking()
            .Where(c => c.SourceKind == kind && c.SourceId == query.SourceId)
            .Select(c => new
            {
                c.Id, c.Status, c.Quantity, c.UnitPriceAmount, c.LineDiscountAmount,
                Billed = db.Set<InvoiceAggregate>().Any(i => i.Status != InvoiceStatus.Discarded && i.Lines.Any(l => l.ChargeId == c.Id)),
            })
            .ToListAsync();

        var active = charges.Where(c => c.Status == ChargeStatus.Active).ToList();
        var chargeIds = active.Select(c => c.Id).ToList();
        var invoices = await db.Set<InvoiceAggregate>().AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Discarded && i.Lines.Any(l => l.ChargeId != null && chargeIds.Contains(l.ChargeId.Value)))
            .Select(i => new { i.Id, i.Number, i.Status, i.Total, i.PaidTotal, i.CreditedTotal })
            .ToListAsync();

        var invoiceViews = invoices.Select(i => new SourceBillingInvoiceViewModel(
            i.Id, i.Number, i.Status.DisplayName,
            BillingMoney.Of(i.Status == InvoiceStatus.Draft ? 0m : InvoiceStatusRules.Outstanding(i.Total, i.PaidTotal, i.CreditedTotal), currency))).ToList();

        var result = new SourceBillingStatusViewModel(
            active.Count, active.Count(c => c.Billed), active.Count(c => !c.Billed), charges.Count(c => c.Status == ChargeStatus.Voided),
            BillingMoney.Of(active.Sum(c => InvoiceCalculator.Round(c.Quantity * c.UnitPriceAmount) - c.LineDiscountAmount), currency), invoiceViews,
            FullyPaid: active.Count > 0 && active.All(c => c.Billed) && invoices.All(i => i.Status == InvoiceStatus.Paid || i.Status == InvoiceStatus.Credited));

        return new QueryResponse<SourceBillingStatusViewModel> { Result = result };
    }
}
