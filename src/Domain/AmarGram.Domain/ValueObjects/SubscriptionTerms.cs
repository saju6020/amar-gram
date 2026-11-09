using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.ValueObjects;

/// <summary>
/// HO-SUB-001 §8.3 (US-SUB-01, US-SUB-02) -- what a subscription delivers and how: quantity, interval, fulfilment and the intended payment method. Created only
/// through <see cref="Create"/>, which refuses an invalid combination with the specific code. Record equality makes "no change" detectable
/// (<c>NoChangeRequested</c>). Whether a payment method is <i>currently available</i> (COD ceiling, zone switch -- BR-15) is not a terms rule: it is asked of
/// Orders by the handler.
/// </summary>
public sealed record SubscriptionTerms
{
    public int Quantity { get; private init; }
    public int IntervalWeeks { get; private init; }
    public SubscriptionFulfilment Fulfilment { get; private init; } = default!;
    public Guid? DeliveryAddressId { get; private init; }
    public Guid? PickupBranchId { get; private init; }
    public SubscriptionPaymentMethod PaymentMethod { get; private init; } = default!;

    private SubscriptionTerms() { }

    public static SubscriptionTerms Create(
        int quantity, int intervalWeeks, SubscriptionFulfilment fulfilment, Guid? deliveryAddressId, Guid? pickupBranchId, SubscriptionPaymentMethod paymentMethod)
    {
        if (quantity < 1 || quantity > SubscriptionRules.MaxQuantity)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidSubscriptionQuantity, $"Quantity must be between 1 and {SubscriptionRules.MaxQuantity}.", nameof(Quantity));

        if (!SubscriptionRules.AllowedIntervalWeeks.Contains(intervalWeeks))
            throw new DomainRuleViolationException(
                BusinessViolationCodes.InvalidSubscriptionInterval, $"Choose a delivery every {string.Join(", ", SubscriptionRules.AllowedIntervalWeeks)} weeks.", nameof(IntervalWeeks));

        var isDelivery = fulfilment == SubscriptionFulfilment.Delivery;
        if (isDelivery && (deliveryAddressId is null || deliveryAddressId == Guid.Empty || pickupBranchId is not null))
            throw new DomainRuleViolationException(BusinessViolationCodes.FulfilmentDetailsInvalid, "A delivery needs a delivery address and no collection branch.", nameof(DeliveryAddressId));

        if (!isDelivery && (pickupBranchId is null || pickupBranchId == Guid.Empty || deliveryAddressId is not null))
            throw new DomainRuleViolationException(BusinessViolationCodes.FulfilmentDetailsInvalid, "A collection needs a branch and no delivery address.", nameof(PickupBranchId));

        if ((paymentMethod == SubscriptionPaymentMethod.PayAtPickup && isDelivery) || (paymentMethod == SubscriptionPaymentMethod.CashOnDelivery && !isDelivery))
            throw new DomainRuleViolationException(
                BusinessViolationCodes.PaymentMethodNotAllowedForFulfilment,
                isDelivery ? "Pay at the shop only goes with collection." : "Cash on delivery only goes with delivery.", nameof(PaymentMethod));

        return new SubscriptionTerms
        {
            Quantity = quantity, IntervalWeeks = intervalWeeks, Fulfilment = fulfilment, DeliveryAddressId = deliveryAddressId, PickupBranchId = pickupBranchId,
            PaymentMethod = paymentMethod,
        };
    }

    /// <summary>The same terms with a different interval (used when the interval alone changes).</summary>
    public SubscriptionTerms WithInterval(int intervalWeeks) =>
        Create(Quantity, intervalWeeks, Fulfilment, DeliveryAddressId, PickupBranchId, PaymentMethod);
}
