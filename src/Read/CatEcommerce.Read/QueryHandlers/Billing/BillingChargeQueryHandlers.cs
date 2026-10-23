using CatEcommerce.Domain.Aggregates.Account;
using CatEcommerce.Domain.Aggregates.Billing;
using CatEcommerce.Infrastructure.Persistence;
using CatEcommerce.Read.Queries.Billing;
using CatEcommerce.Read.ViewModels;
using CatEcommerce.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace CatEcommerce.Read.QueryHandlers.Billing;

/// <summary>HO-BIL-001 §12.6 -- explicit projection, <c>AsNoTracking</c>, paged in SQL.</summary>
public sealed class GetChargesQueryHandler(CatEcommerceDbContext db) : IQueryHandlerAsync<GetChargesQuery, PagedResult<ChargeViewModel>>
{
    public async Task<QueryResponse<PagedResult<ChargeViewModel>>> HandleAsync(GetChargesQuery query)
    {
        var pageSize = Math.Clamp(query.PageSize <= 0 ? 50 : query.PageSize, 1, 200);
        var pageNumber = Math.Max(query.PageNumber, 1);

        var charges = db.Set<ChargeAggregate>().AsNoTracking().Where(c => !c.IsMarkedToDelete && c.BranchId == query.BranchId);
        if (query.CustomerId is { } customerId) charges = charges.Where(c => c.CustomerId == customerId);
        if (!string.IsNullOrWhiteSpace(query.SourceKind) && EnumerationParsing.TryParse<ChargeSourceKind>(query.SourceKind, out var kind) && kind is not null)
            charges = charges.Where(c => c.SourceKind == kind);

        charges = ChargeStatusFilter.Apply(db, charges, query.Status);

        var total = await charges.CountAsync();
        var rows = await (
            from c in charges.OrderByDescending(c => c.RecordedOn).ThenBy(c => c.Id).Skip((pageNumber - 1) * pageSize).Take(pageSize)
            join customer in db.Set<CustomerAccountAggregate>().AsNoTracking() on c.CustomerId equals customer.Id into customers
            from customer in customers.DefaultIfEmpty()
            select new
            {
                c.Id, c.CustomerId, CustomerName = customer != null ? customer.FullName : "", c.BranchId, c.BusinessLine, c.ItemKind,
                c.SourceKind, c.SourceId, c.SourceLineRef, c.Description, c.Quantity, c.UnitPriceAmount,
                c.LineDiscountAmount, c.CurrencyCode, c.TaxClassId, c.ServiceDate, c.Status, c.RecordedOn, c.VoidReason,
            }).ToListAsync();

        var billed = await BilledOnInvoiceLookup.ForChargesAsync(db, rows.Select(r => r.Id).ToList());

        var items = rows.Select(r => new ChargeViewModel(
            r.Id, r.CustomerId, r.CustomerName, r.BranchId, r.BusinessLine.DisplayName, r.ItemKind.DisplayName,
            r.SourceKind.DisplayName, r.SourceId, r.SourceLineRef, r.Description,
            BillingMoney.Quantity(r.Quantity), BillingMoney.Of(r.UnitPriceAmount, r.CurrencyCode), BillingMoney.Of(r.LineDiscountAmount, r.CurrencyCode),
            BillingMoney.Of(decimal.Round(r.Quantity * r.UnitPriceAmount, 2, MidpointRounding.AwayFromZero) - r.LineDiscountAmount, r.CurrencyCode),
            r.TaxClassId, r.ServiceDate, r.Status.DisplayName, r.RecordedOn, r.VoidReason, billed.GetValueOrDefault(r.Id))).ToList();

        return new QueryResponse<PagedResult<ChargeViewModel>> { Result = new PagedResult<ChargeViewModel>(items, pageNumber, pageSize, total) };
    }
}

/// <summary>The status vocabulary of the charges list (§12.4): <c>unbilled</c>, <c>billed</c>, <c>voided</c>.</summary>
internal static class ChargeStatusFilter
{
    public static IQueryable<ChargeAggregate> Apply(CatEcommerceDbContext db, IQueryable<ChargeAggregate> charges, string? status) =>
        (status ?? string.Empty).ToLowerInvariant() switch
        {
            "voided" => charges.Where(c => c.Status == ChargeStatus.Voided),
            "unbilled" => charges.Where(c => c.Status == ChargeStatus.Active && !db.Set<InvoiceAggregate>().Any(i => i.Status != InvoiceStatus.Discarded && i.Lines.Any(l => l.ChargeId == c.Id))),
            "billed" => charges.Where(c => c.Status == ChargeStatus.Active && db.Set<InvoiceAggregate>().Any(i => i.Status != InvoiceStatus.Discarded && i.Lines.Any(l => l.ChargeId == c.Id))),
            _ => charges,
        };
}

/// <summary>"Billed" is derived (ADR-178): a line of a non-discarded invoice references the charge.</summary>
internal static class BilledOnInvoiceLookup
{
    public static async Task<Dictionary<Guid, BilledOnInvoiceViewModel>> ForChargesAsync(CatEcommerceDbContext db, IReadOnlyCollection<Guid> chargeIds)
    {
        if (chargeIds.Count == 0) return [];

        var ids = chargeIds.ToList();
        var rows = await db.Set<InvoiceAggregate>().AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Discarded)
            .SelectMany(i => i.Lines.Where(l => l.ChargeId != null && ids.Contains(l.ChargeId.Value))
                .Select(l => new { ChargeId = l.ChargeId!.Value, InvoiceId = i.Id, i.Number, i.Status }))
            .ToListAsync();

        return rows.ToDictionary(r => r.ChargeId, r => new BilledOnInvoiceViewModel(r.InvoiceId, r.Number, r.Status.DisplayName));
    }
}
