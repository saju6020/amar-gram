using CatEcommerce.Domain.Models;
using CatEcommerce.Domain.ValueObjects;

namespace CatEcommerce.Domain.DomainServices;

/// <summary>
/// HO-BIL-001 §12.2 -- Billing's read-only view of Administration's tables ("prices and tax rates at
/// <i>t</i>", HO-ADM-001 §8.6). Billing never edits an Administration aggregate.
/// </summary>
public interface IBillingPricingInputs
{
    /// <summary>One entry per tax class that exists; <see cref="TaxRateInfo.RatePercent"/> is null when the
    /// class has no rate effective at <paramref name="at"/>. A class that does not exist is absent.</summary>
    Task<IReadOnlyDictionary<Guid, TaxRateInfo>> GetTaxRatesAsync(IReadOnlyCollection<Guid> taxClassIds, DateTimeOffset at, CancellationToken ct = default);
}
