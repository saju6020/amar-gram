using System.Globalization;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence.ReportingViews;
using AmarGram.Infrastructure.Reporting;
using AmarGram.Read.Queries.Reporting;
using AmarGram.Read.QueryHandlers.Reporting.Sources;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Reporting.Dashboard;

/// <summary>
/// HO-P4 BG-1 -- the dashboard chart's per-day sales series. Runs inside the same read-only <see cref="IReportingReadScope"/> as the dashboard and takes net revenue from
/// <see cref="RevenueLoader"/> and <see cref="RevenueBuilder"/> -- the machinery behind the revenue reports -- so the chart cannot disagree with them. Days are the branch's local
/// days; a day with no invoice is present with a zero amount. Only the shop's own currency is charted (the currency guard keeps the shop to one).
/// </summary>
public sealed class GetSalesSeriesQueryHandler(IReportingReadScope scope, IBusinessSettings settings, TimeProvider timeProvider)
    : IQueryHandlerAsync<GetSalesSeriesQuery, SalesSeriesOutcome>
{
    public async Task<QueryResponse<SalesSeriesOutcome>> HandleAsync(GetSalesSeriesQuery query)
    {
        if (query.ActiveBranchId is not { } branchId)
            return new QueryResponse<SalesSeriesOutcome> { Result = new SalesSeriesOutcome(null, BusinessViolationCodes.BranchNotAssigned) };

        var days = Math.Clamp(query.Days <= 0 ? GetSalesSeriesQuery.DefaultDays : query.Days, 1, GetSalesSeriesQuery.MaxDays);
        var now = timeProvider.GetUtcNow();

        var view = await scope.RunAsync(async (db, ct) =>
        {
            var branch = await db.Set<RvBranchRow>().AsNoTracking().Where(b => b.BranchId == branchId).FirstOrDefaultAsync(ct);
            var zone = ResolveZone(branch?.TimeZoneId);
            var currency = settings.GetString(SettingKeys.CommerceCurrencyCode, branchId);
            var context = new DashboardContext(db, branchId, zone, now, query.CallerId, settings, currency);

            var to = context.Today;
            var from = to.AddDays(-(days - 1));

            var request = context.Request(ReportCatalogue.RevenueByBusinessLineKey, from, to);
            var facts = await RevenueLoader.LoadAsync(db, request, shopOnly: false, includeCost: false, ct);
            var netByDay = RevenueBuilder.Aggregate(facts.Where(f => f.Currency == currency), TimeBucket.Day, _ => [])
                .GroupBy(a => DateOnly.ParseExact(a.Bucket, "yyyy-MM-dd", CultureInfo.InvariantCulture))
                .ToDictionary(g => g.Key, g => ReportMath.Money(g.Sum(a => a.Net)));

            var (start, end) = context.Instants(from, to);
            var cancelled = OrderStatus.Cancelled.Value;
            var placed = await db.Set<RvOrderRow>().AsNoTracking()
                .Where(o => o.BranchId == branchId && o.PlacedOn >= start && o.PlacedOn < end && o.Status != cancelled)
                .Select(o => o.PlacedOn).ToListAsync(ct);
            var ordersByDay = placed.GroupBy(p => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(p, zone).DateTime)).ToDictionary(g => g.Key, g => g.Count());

            var series = Enumerable.Range(0, days).Select(i => from.AddDays(i))
                .Select(date => new SalesSeriesDayViewModel(date, OrderMoney.Of(netByDay.GetValueOrDefault(date), currency), ordersByDay.GetValueOrDefault(date)))
                .ToList();

            return new SalesSeriesViewModel(
                branchId, branch?.Name ?? string.Empty, from, to, zone.Id, currency, OrderMoney.Of(netByDay.Values.Sum(), currency), now, series);
        }, CancellationToken.None);

        return new QueryResponse<SalesSeriesOutcome> { Result = new SalesSeriesOutcome(view, null) };
    }

    private static TimeZoneInfo ResolveZone(string? id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(id) ? BillingRules.DefaultTimeZoneId : id); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById(BillingRules.DefaultTimeZoneId); }
    }
}
