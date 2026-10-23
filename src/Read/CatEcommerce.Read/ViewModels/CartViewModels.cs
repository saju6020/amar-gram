namespace CatEcommerce.Read.ViewModels;

/// <summary>One cart line as the storefront shows it (HO-ORD-001 §12.4). <c>Availability</c> is <c>InStock</c>, <c>Limited</c> (less than the line's
/// quantity is left) or <c>Unavailable</c>; it is <b>advisory</b> -- a cart reserves nothing.</summary>
public sealed record CartLineViewModel(
    Guid LineId, Guid SkuId, Guid ProductId, string ProductName, string VariantLabel, string? ImagePath, int Quantity,
    MoneyViewModel? UnitPrice, MoneyViewModel PriceWhenAdded, bool PriceChanged, string Availability, int? AvailableQuantity,
    MoneyViewModel? LineSubtotal);

/// <summary><c>GuestCartPending</c> is true when a customer session and a live guest cart are both present -- the cue to offer the merge.</summary>
public sealed record CartViewModel(
    Guid? CartId, IReadOnlyList<CartLineViewModel> Lines, int ItemCount, MoneyViewModel Subtotal, int MaxQuantityPerLine, bool GuestCartPending);
