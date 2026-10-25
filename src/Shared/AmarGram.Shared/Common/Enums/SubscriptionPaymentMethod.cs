namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// HO-SUB-001 §10.1, ADR-238 -- the intended payment method of every cycle's order. <b>No online value</b>: there is no gateway, no saved token and no
/// auto-charge in v1; a cycle raises an ordinary order paid the way any order is paid. Mapped to <see cref="OrderPaymentMethod"/> at generation.
/// </summary>
public sealed class SubscriptionPaymentMethod(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionPaymentMethod CashOnDelivery = new(1, nameof(CashOnDelivery));
    public static readonly SubscriptionPaymentMethod BankTransfer = new(2, nameof(BankTransfer));
    public static readonly SubscriptionPaymentMethod PayAtPickup = new(3, nameof(PayAtPickup));

    /// <summary>The order payment method a cycle's order is placed with.</summary>
    public OrderPaymentMethod ToOrderPaymentMethod() =>
        this == CashOnDelivery ? OrderPaymentMethod.CashOnDelivery
        : this == BankTransfer ? OrderPaymentMethod.BankTransfer
        : OrderPaymentMethod.PayOnCollection;
}
