using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Order;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Order;

/// <summary>HO-ORD-001 §12.6 (Phase B) -- the delivery-zone list: a projection, never an aggregate (ADR-012).</summary>
public sealed class GetDeliveryZonesQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetDeliveryZonesQuery, IReadOnlyList<DeliveryZoneSummaryViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<DeliveryZoneSummaryViewModel>>> HandleAsync(GetDeliveryZonesQuery query)
    {
        var rows = await db.DeliveryZones.AsNoTracking()
            .OrderBy(z => z.Name)
            .Take(AdministrationListCaps.MaxUnboundedListSize)
            .Select(z => new
            {
                z.Id, z.BranchId, z.Name, z.Priority, z.IsActive, z.CodEnabled,
                CoverageCount = z.Coverage.Count,
                Levels = z.Services.OrderBy(s => s.ServiceLevel).Select(s => s.ServiceLevel).ToList(),
            })
            .ToListAsync();

        IReadOnlyList<DeliveryZoneSummaryViewModel> result = rows
            .Select(r => new DeliveryZoneSummaryViewModel(r.Id, r.BranchId, r.Name, r.Priority, r.IsActive, r.CodEnabled, r.CoverageCount, r.Levels.Select(l => l.DisplayName).ToList()))
            .ToList();

        return new QueryResponse<IReadOnlyList<DeliveryZoneSummaryViewModel>> { Result = result };
    }
}

public sealed class GetDeliveryZoneQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetDeliveryZoneQuery, DeliveryZoneViewModel?>
{
    public async Task<QueryResponse<DeliveryZoneViewModel?>> HandleAsync(GetDeliveryZoneQuery query)
    {
        var row = await db.DeliveryZones.AsNoTracking()
            .Where(z => z.Id == query.ZoneId)
            .Select(z => new
            {
                z.Id, z.BranchId, z.Name, z.Priority, z.IsActive, z.CodEnabled, z.CodMaxOrderValue, z.CurrencyCode, z.Version,
                Coverage = z.Coverage.Select(c => new { c.District, c.PostalCodes }).ToList(),
                Services = z.Services.Select(s => new { s.ServiceLevel, s.IsActive, s.BaseCharge, s.FreeOverOrderValue, s.LeadTimeDays, s.WeightBands, s.SlotWindows }).ToList(),
            })
            .FirstOrDefaultAsync();

        if (row is null) return new QueryResponse<DeliveryZoneViewModel?> { Result = null };

        var currency = row.CurrencyCode;
        var view = new DeliveryZoneViewModel(
            row.Id, row.BranchId, row.Name, row.Priority, row.IsActive, row.CodEnabled, OrderMoney.Of(row.CodMaxOrderValue, currency), currency, row.Version,
            row.Coverage.Select(c => new ZoneCoverageViewModel(c.District, c.PostalCodes)).OrderBy(c => c.District, StringComparer.OrdinalIgnoreCase).ToList(),
            row.Services.OrderBy(s => s.ServiceLevel.Value).Select(s => new ZoneServiceViewModel(
                s.ServiceLevel.DisplayName, s.IsActive, OrderMoney.Of(s.BaseCharge, currency), OrderMoney.Of(s.FreeOverOrderValue, currency), s.LeadTimeDays,
                s.WeightBands.Select(b => new WeightBandViewModel(b.UpToGrams, OrderMoney.Of(b.Surcharge, currency))).ToList(),
                s.SlotWindows.Select(w => new SlotWindowViewModel(w.DayOfWeek.ToString(), w.Start.ToString("HH:mm"), w.End.ToString("HH:mm"), w.Label)).ToList())).ToList());

        return new QueryResponse<DeliveryZoneViewModel?> { Result = view };
    }
}

/// <summary>US-ORD-06 AC2 -- the same pure resolver the checkout uses, over the active zones' coverage rows (a small configuration table).</summary>
public sealed class ResolveDeliveryZoneQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<ResolveDeliveryZoneQuery, ResolvedDeliveryZoneViewModel>
{
    public async Task<QueryResponse<ResolvedDeliveryZoneViewModel>> HandleAsync(ResolveDeliveryZoneQuery query)
    {
        var rows = await db.DeliveryZones.AsNoTracking()
            .Where(z => z.IsActive)
            .Select(z => new { z.Id, z.BranchId, z.Name, z.Priority, z.IsActive, Coverage = z.Coverage.Select(c => new { c.District, c.PostalCodes }).ToList() })
            .ToListAsync();

        var zones = rows.Select(r => new ResolvableZone(r.Id, r.Name, r.Priority, r.IsActive, r.Coverage.Select(c => new CoverageRule(c.District, c.PostalCodes)).ToList())).ToList();
        var resolved = DeliveryZoneResolver.Resolve(zones, query.District, query.PostalCode);

        var result = resolved is null
            ? new ResolvedDeliveryZoneViewModel(false, null, null, null, BusinessViolationCodes.AddressOutsideServedZones)
            : new ResolvedDeliveryZoneViewModel(true, resolved.ZoneId, resolved.Name, rows.Single(r => r.Id == resolved.ZoneId).BranchId, null);

        return new QueryResponse<ResolvedDeliveryZoneViewModel> { Result = result };
    }
}

public sealed class GetCouriersQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetCouriersQuery, IReadOnlyList<CourierViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<CourierViewModel>>> HandleAsync(GetCouriersQuery query)
    {
        var couriers = db.Couriers.AsNoTracking().Where(c => !query.ActiveOnly || c.IsActive);

        IReadOnlyList<CourierViewModel> result = await couriers
            .OrderBy(c => c.Name)
            .Take(AdministrationListCaps.MaxUnboundedListSize)
            .Select(c => new CourierViewModel(c.Id, c.Name, c.TrackingUrlTemplate, c.SupportsCod, c.IsActive))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<CourierViewModel>> { Result = result };
    }
}

public sealed class GetBankTransferAccountQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetBankTransferAccountQuery, BankTransferAccountViewModel>
{
    public async Task<QueryResponse<BankTransferAccountViewModel>> HandleAsync(GetBankTransferAccountQuery query)
    {
        var account = await db.BankTransferAccounts.AsNoTracking()
            .Where(a => a.Id == BankTransferAccountAggregate.SingletonId)
            .Select(a => new BankTransferAccountViewModel(true, a.AccountName, a.AccountNumber, a.BankName, a.BranchName, a.RoutingNumber, a.IsActive))
            .FirstOrDefaultAsync();

        return new QueryResponse<BankTransferAccountViewModel> { Result = account ?? new BankTransferAccountViewModel(false, null, null, null, null, null, false) };
    }
}

public sealed class GetDiscountCodesQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetDiscountCodesQuery, IReadOnlyList<DiscountCodeViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<DiscountCodeViewModel>>> HandleAsync(GetDiscountCodesQuery query)
    {
        var rows = await db.DiscountCodes.AsNoTracking()
            .OrderByDescending(c => c.CreatedDate)
            .Take(AdministrationListCaps.MaxUnboundedListSize)
            .Select(c => new
            {
                c.Id, c.Code, c.Description, c.Kind, c.Percent, c.Amount, c.MinimumSpend, c.CurrencyCode, c.Scope, c.ProductIds, c.CategoryIds,
                c.FirstOrderOnly, c.UsageLimit, c.PerCustomerLimit, c.ValidFrom, c.ValidTo, c.IsActive, c.TimesRedeemed, c.Version,
            })
            .ToListAsync();

        IReadOnlyList<DiscountCodeViewModel> result = rows.Select(c => new DiscountCodeViewModel(
            c.Id, c.Code, c.Description, c.Kind.DisplayName, c.Percent, OrderMoney.Of(c.Amount, c.CurrencyCode), OrderMoney.Of(c.MinimumSpend, c.CurrencyCode),
            c.Scope.DisplayName, c.ProductIds, c.CategoryIds, c.FirstOrderOnly, c.UsageLimit, c.PerCustomerLimit, c.ValidFrom, c.ValidTo, c.IsActive, c.TimesRedeemed, c.Version)).ToList();

        return new QueryResponse<IReadOnlyList<DiscountCodeViewModel>> { Result = result };
    }
}

/// <summary>HO-P3 G5 -- see <see cref="GetDeliveryPromiseQuery"/>: the primary zone's Standard level, from the same zone data the checkout quote prices with.</summary>
public sealed class GetDeliveryPromiseQueryHandler(AmarGramDbContext db, Microsoft.Extensions.Options.IOptions<AmarGram.Infrastructure.Configuration.ShopOptions> shopOptions)
    : IQueryHandlerAsync<GetDeliveryPromiseQuery, DeliveryPromiseViewModel>
{
    public async Task<QueryResponse<DeliveryPromiseViewModel>> HandleAsync(GetDeliveryPromiseQuery query)
    {
        var branchId = shopOptions.Value.EffectiveStorefrontBranchId;
        var standard = AmarGram.Shared.Common.Enums.DeliveryServiceLevel.Standard;

        var row = await db.DeliveryZones.AsNoTracking()
            .Where(z => z.BranchId == branchId && z.IsActive && z.Services.Any(s => s.IsActive && s.ServiceLevel == standard))
            .OrderBy(z => z.Priority).ThenBy(z => z.Name)
            .Select(z => new
            {
                z.CurrencyCode,
                Service = z.Services.Where(s => s.IsActive && s.ServiceLevel == standard).Select(s => new { s.FreeOverOrderValue, s.LeadTimeDays }).First(),
            })
            .FirstOrDefaultAsync();

        var result = row is null
            ? new DeliveryPromiseViewModel(null, null, null)
            : new DeliveryPromiseViewModel(row.CurrencyCode, OrderMoney.Of(row.Service.FreeOverOrderValue, row.CurrencyCode), row.Service.LeadTimeDays);

        return new QueryResponse<DeliveryPromiseViewModel> { Result = result };
    }
}
