using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Infrastructure.Product;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Billing;

/// <summary>
/// HO-BIL-001 §12.2 -- Billing's <b>read-only</b> view of Administration's tables (HO-ADM-001 §8.6: "price and
/// tax rate at <i>t</i> = the row with the greatest <c>EffectiveFrom</c> not after <i>t</i>"). Always
/// <c>AsNoTracking</c>; Billing never edits an Administration aggregate.
/// </summary>
public sealed class BillingPricingInputs(AmarGramDbContext db) : IBillingPricingInputs
{
    public async Task<IReadOnlyDictionary<Guid, TaxRateInfo>> GetTaxRatesAsync(
        IReadOnlyCollection<Guid> taxClassIds, DateTimeOffset at, CancellationToken ct = default)
    {
        if (taxClassIds.Count == 0) return new Dictionary<Guid, TaxRateInfo>();

        var ids = taxClassIds.Distinct().ToList();

        var classes = await db.Set<TaxClassAggregate>().AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .Select(t => new { t.Id, t.Code })
            .ToListAsync(ct);

        var rates = await db.Set<TaxRateAggregate>().AsNoTracking()
            .Where(r => ids.Contains(r.TaxClassId) && r.EffectiveFrom <= at)
            .Select(r => new { r.TaxClassId, r.RatePercent, r.EffectiveFrom })
            .ToListAsync(ct);

        var latest = rates
            .GroupBy(r => r.TaxClassId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.EffectiveFrom).First().RatePercent);

        return classes.ToDictionary(c => c.Id, c => new TaxRateInfo(c.Id, c.Code, latest.TryGetValue(c.Id, out var rate) ? rate : null));
    }
}
