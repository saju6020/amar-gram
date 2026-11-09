using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Read.QueryHandlers.Subscription;

/// <summary>
/// Owner decision 2026-11-09 -- names the subscriber discount on an order or invoice. A subscription order is one placed on the Subscription channel (the system places them; no customer or staff action can set it) and the discount
/// is its line discount, so the key is <c>Channel == Subscription</c> with a line discount above zero. The percentage
/// is the cycle's snapshotted <c>DiscountPercent</c>; if the cycle is not found the label is the plain text. Read-only; the amounts stay as the order froze them.
/// </summary>
internal static class SubscriptionDiscountLabels
{
    /// <summary>The label for an invoice's discount total: set only when every discounted line carries the same label; a mixed invoice (another percentage, or an ordinary
    /// discounted line beside a subscription one) has none, because the total would then name only part of itself.</summary>
    public static string? TotalsLabel(IEnumerable<(decimal LineDiscount, string? Label)> lines)
    {
        var discounted = lines.Where(l => l.LineDiscount > 0m).ToList();
        if (discounted.Count == 0 || discounted.Any(l => l.Label is null)) return null;

        var labels = discounted.Select(l => l.Label).Distinct().ToList();
        return labels.Count == 1 ? labels[0] : null;
    }

    /// <summary>The discount code a staff screen shows for an order. A subscription order stores the subscriber discount's label in the code column (ADR-242: a synthetic
    /// rule, never a stored code), so it has no code to show; the discount itself is named on the line-discount row ("Subscription discount (10%)").
    /// Owner decision 2026-11-09: the screens must not call it a discount code.</summary>
    public static string? StaffDiscountCode(OrderChannel channel, string? discountCodeText) =>
        channel == OrderChannel.Subscription ? null : discountCodeText;

    /// <summary>Order id -> label, only for the subscription orders among <paramref name="orderIds"/>.</summary>
    public static async Task<IReadOnlyDictionary<Guid, string>> ForOrdersAsync(AmarGramDbContext db, IReadOnlyCollection<Guid> orderIds)
    {
        if (orderIds.Count == 0) return new Dictionary<Guid, string>();

        var subscriptionOrders = await db.Orders.AsNoTracking()
            .Where(o => orderIds.Contains(o.Id) && o.Channel == OrderChannel.Subscription && o.Totals.LineDiscountTotal > 0m)
            .Select(o => o.Id).ToListAsync();
        if (subscriptionOrders.Count == 0) return new Dictionary<Guid, string>();

        var percents = await db.SubscriptionCycles.AsNoTracking()
            .Where(c => c.OrderId != null && subscriptionOrders.Contains(c.OrderId.Value))
            .Select(c => new { OrderId = c.OrderId!.Value, c.DiscountPercent }).ToListAsync();

        return subscriptionOrders.ToDictionary(
            id => id,
            id => SubscriptionMessages.DiscountLabelWith(percents.Where(p => p.OrderId == id).Select(p => (decimal?)p.DiscountPercent).FirstOrDefault()));
    }
}
