using AmarGram.Domain.Models;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-ORD-001 §8.14 -- loads everything the pure <c>CheckoutPricing</c> needs for one customer and one set of checkout choices, in as few round trips as
/// possible: the cart, the SKU snapshots, the quantity that can be sold at the fulfilling branch,
/// the tax rates in force, the zone the address falls in with its service levels, the branch calendar, the discount code and the customer's use of it,
/// the payment switches, and the policies still to be accepted. Read-only (<c>AsNoTracking</c>, projections): the placement handler loads the discount
/// code as a <b>tracked</b> aggregate separately, because it mutates it. Implemented in Infrastructure.
/// </summary>
public interface ICheckoutInputsLoader
{
    Task<CheckoutInputs> LoadAsync(Guid customerId, FulfilmentChoice choice, DateTimeOffset now, CancellationToken ct);

    /// <summary>
    /// HO-ORD-001 §8.11 -- the inputs of a <b>counter</b> sale: the lines the cashier scanned (not a cart), priced and capped at what the branch can sell, no delivery, no
    /// pending policies. <paramref name="customerId"/> is optional (an anonymous walk-in).
    /// </summary>
    /// <summary>
    /// HO-SUB-001 §8.12 (ADR-242) -- the inputs of a <b>subscription</b> order: the cycle's lines (not a cart), priced at the price in force now, capped at what the
    /// fulfilling branch can sell, no pending policies (a system-placed order cannot ask the customer to accept one). <paramref name="discountPercent"/> is the
    /// subscriber discount: when above zero it is applied as a labelled <b>line discount</b> on every line (a synthetic, unlimited product-scoped rule, never a
    /// stored code). The caller (the subscription order handler) reads the quote's lines back to refuse a partial quantity.
    /// </summary>
    Task<CheckoutInputs> LoadSubscriptionAsync(
        Guid customerId, IReadOnlyList<CounterLineRequest> lines, FulfilmentChoice choice, decimal discountPercent, DateTimeOffset now, CancellationToken ct) =>
        throw new NotSupportedException("This loader does not load subscription orders.");

    Task<CheckoutInputs> LoadCounterAsync(Guid branchId, Guid? customerId, IReadOnlyList<CounterLineRequest> lines, string? discountCode, DateTimeOffset now, CancellationToken ct);
}

/// <summary>A line the cashier scanned: the SKU and how many.</summary>
public sealed record CounterLineRequest(Guid SkuId, int Quantity);
