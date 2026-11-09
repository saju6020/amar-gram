using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Order;

/// <summary>HO-ORD-001 §8.11 step 1 (US-ORD-16 AC2) -- a barcode scanned at the till: the SKU, its price, what the branch can sell and the FEFO batch the next unit would
/// come from. Null (-> <c>404</c>) when no purchasable SKU carries the barcode.</summary>
public sealed class GetPosSkuQuery : Query<PosSkuViewModel?>
{
    public required Guid BranchId { get; init; }
    public required string Barcode { get; init; }
}

/// <summary>The manual fallback when a barcode will not scan: purchasable SKUs whose code, name or barcode contains the text.</summary>
public sealed class SearchPosSkusQuery : Query<IReadOnlyList<PosSkuViewModel>>
{
    public required Guid BranchId { get; init; }
    public required string Text { get; init; }
}

/// <summary>HO-P4 BG-6 -- browse the sellable SKUs for the counter-sale grid, paged, optionally within one category. Sellable = an Active SKU of an Active, listed product with a price in
/// force (a bundle also needs every component sellable) -- the same rule as the text search; <c>Sellable</c> on each row is the quantity the branch can sell now (may be 0).</summary>
public sealed class BrowsePosSkusQuery : Query<PagedResult<PosSkuViewModel>>
{
    public required Guid BranchId { get; init; }
    public ProductCategory? Category { get; init; }
}

public sealed record CounterQuoteLine(Guid SkuId, int Quantity);

/// <summary>The counter quote -- the sale priced exactly as completing it would price it, without any state change.</summary>
public sealed class GetCounterQuoteQuery : Query<CounterQuoteViewModel>
{
    public required Guid BranchId { get; init; }
    public Guid? CustomerId { get; init; }
    public required IReadOnlyList<CounterQuoteLine> Lines { get; init; }
    public string? DiscountCode { get; init; }

    /// <summary>HO-P4 BG-7: the cash the customer hands over, if the cashier has typed it. The quote then answers <c>changeDue</c> (or <c>cashShort</c>) from the same tender rule completing the sale uses.</summary>
    public decimal? TenderedCash { get; init; }
}

/// <summary>The receipt of a finished counter sale (structured, plus the 48-column text). Null (-> <c>404</c>) when it is not a counter sale of this branch.</summary>
public sealed class GetReceiptQuery : Query<ReceiptViewModel?>
{
    public required Guid BranchId { get; init; }
    public required Guid OrderId { get; init; }
}
