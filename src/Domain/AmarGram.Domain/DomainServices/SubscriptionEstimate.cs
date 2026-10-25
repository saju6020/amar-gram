using AmarGram.Shared.Common.Helpers;

namespace AmarGram.Domain.DomainServices;

/// <summary>The estimate shown before subscribing and in each pre-charge notice: goods only. Orders' total governs.</summary>
public sealed record SubscriptionEstimateResult(
    decimal UnitPrice, int Quantity, decimal Subtotal, decimal DiscountPercent, decimal DiscountAmount, decimal EstimatedTotal);

/// <summary>
/// HO-SUB-001 §8.13 (C-6, US-ORD-04 AC2, ADR-242) -- <c>unitPrice x quantity</c> less the subscription discount, all in <b>integer minor units</b>, the discount
/// rounded half-up to the minor unit. Delivery and tax are <i>not</i> estimated: they are calculated when each order is placed.
/// </summary>
public static class SubscriptionEstimate
{
    public static SubscriptionEstimateResult Compute(decimal unitPrice, int quantity, decimal discountPercent)
    {
        var subtotal = MinorUnits.FromAmount(unitPrice).Times(quantity);
        var discount = MinorUnits.Min(subtotal.Percent(MinorUnits.PercentToHundredths(discountPercent)), subtotal);
        return new SubscriptionEstimateResult(unitPrice, quantity, subtotal.ToAmount(), discountPercent, discount.ToAmount(), (subtotal - discount).ToAmount());
    }
}
