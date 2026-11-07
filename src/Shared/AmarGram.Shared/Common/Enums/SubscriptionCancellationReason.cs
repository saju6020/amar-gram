namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// HO-SUB-001 §10.1 -- the churn reasons of SRS §8.3. The first six are chosen by the customer; the last three are set by the system or by staff.
/// </summary>
public sealed class SubscriptionCancellationReason(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly SubscriptionCancellationReason NoLongerNeeded = new(1, nameof(NoLongerNeeded));
    public static readonly SubscriptionCancellationReason TooMuchStock = new(2, nameof(TooMuchStock));
    public static readonly SubscriptionCancellationReason TastesDidNotSuit = new(3, nameof(TastesDidNotSuit));
    public static readonly SubscriptionCancellationReason TooExpensive = new(4, nameof(TooExpensive));
    public static readonly SubscriptionCancellationReason SwitchingProduct = new(5, nameof(SwitchingProduct));
    public static readonly SubscriptionCancellationReason Other = new(6, nameof(Other));
    public static readonly SubscriptionCancellationReason StaffCancelled = new(7, nameof(StaffCancelled));
    public static readonly SubscriptionCancellationReason CustomerMerged = new(8, nameof(CustomerMerged));
    public static readonly SubscriptionCancellationReason AccountDeleted = new(9, nameof(AccountDeleted));

    /// <summary>The reasons a customer may choose for themselves.</summary>
    public bool IsCustomerChoice => Value <= Other.Value;
}
