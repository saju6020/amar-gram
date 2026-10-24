namespace AmarGram.Api.Contracts.Order;

public sealed class PosLineRequest
{
    public Guid SkuId { get; init; }
    public int Quantity { get; init; }
}

public sealed class PosTenderRequest
{
    public string Method { get; init; } = default!;
    public decimal Amount { get; init; }
    public string? Reference { get; init; }
}

/// <summary><c>POST /api/staff/pos/quote</c> -- the sale priced without any state change.</summary>
public sealed class PosQuoteRequest
{
    public Guid? CustomerId { get; init; }
    public IReadOnlyList<PosLineRequest> Lines { get; init; } = [];
    public string? DiscountCode { get; init; }

    /// <summary>HO-P4 BG-7: the cash the customer hands over; the quote answers <c>changeDue</c> (or <c>cashShort</c>) for it. Above zero, at most two decimals.</summary>
    public decimal? TenderedCash { get; init; }
}

/// <summary><c>POST /api/staff/pos/sales</c>. A <c>Cash</c> tender's amount is the money handed over (the change is worked out); an <c>InStoreCard</c> tender is charged at face
/// value and carries the terminal slip reference, never a card number.</summary>
public sealed class PosSaleRequest
{
    /// <summary>Both or neither (ADR-216; HO-P4 BG-8): an active customer with this primary mobile is the buyer, else a passwordless customer is registered with this name.
    /// Leave both out for an anonymous walk-in sale (no customer on the order; invoiced to the counter-sale system account).</summary>
    public string? CustomerName { get; init; }
    public string? CustomerMobile { get; init; }
    public IReadOnlyList<PosLineRequest> Lines { get; init; } = [];
    public string? DiscountCode { get; init; }
    public IReadOnlyList<PosTenderRequest> Tenders { get; init; } = [];
}
