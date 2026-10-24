namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-P4 BG-8 (owner approved 2026-10-25) -- a counter sale may be made without the buyer's name and mobile. The sale's <b>order</b> then has no customer
/// (<c>CustomerId</c> null: no order history, no discount-per-customer count, no customer message), but Billing's invoice and payments need an account to be
/// addressed to, so they are addressed to one <b>system account</b> that is found (or, the first time, registered through the ordinary walk-in registration) by its
/// <b>reserved mobile number</b>. The reserved number is not routable for an SMS: Accounts refuses it to a self-registering customer and the system account itself
/// is frozen (no contact edit, password, merge or erasure), and Notifications treats it as not-active so no message is ever sent to it. This is the safe form of the
/// shared walk-in account ADR-216 once rejected: there the number was unprotected, so anyone could claim it before the first anonymous sale (backlog ORD 15, 21).
/// </summary>
public static class AnonymousCounterCustomer
{
    /// <summary>The reserved mobile number as a cashier would type it. Normalised: <see cref="NormalisedMobile"/>.</summary>
    public const string Mobile = "01000000000";

    /// <summary>The same number as <c>MobileNumber.Create</c> stores it (<c>+880…</c>).</summary>
    public const string NormalisedMobile = "+8801000000000";

    /// <summary>The name of the system account (and the only name the walk-in registration accepts for the reserved number).</summary>
    public const string FullName = "Counter sale - customer details not taken";

    /// <summary>The recipient name printed on the order of an anonymous sale.</summary>
    public const string RecipientName = "Walk-in customer";

    public static bool IsReservedMobile(string? normalisedMobile) => string.Equals(normalisedMobile, NormalisedMobile, StringComparison.Ordinal);
}
