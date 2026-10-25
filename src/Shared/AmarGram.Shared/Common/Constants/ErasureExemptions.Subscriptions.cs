namespace AmarGram.Shared.Common.Constants;

/// <summary>Subscriptions (HO-SUB-001) is exempted from <c>IPersonalDataEraser</c> registration (HO-XCT-001 §5.2 C-ALL-2): it keeps a customer id, ids of a
/// SKU, address and branch, and a product-name snapshot -- no name, phone or address text. Account deletion cancels every live subscription
/// (<c>CancelSubscriptionsOnAccountDeletedHandler</c>, ADR-247) and the cancellation note, the one free-text field, is cleared with it.</summary>
public static partial class ErasureExemptions
{
    private static readonly IReadOnlyList<(string ContextKey, string Reason)> SubscriptionEntries =
    [
        ("subscription", "Customer id only (plus ids of a SKU, address and branch and a product-name snapshot); every live subscription is cancelled and its note cleared on anonymisation (HO-SUB-001 ADR-247)."),
    ];
}
