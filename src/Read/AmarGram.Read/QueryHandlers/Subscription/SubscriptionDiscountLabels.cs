using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Read.QueryHandlers.Subscription;

/// <summary>
/// Owner decision 2026-11-09 -- names the subscriber discount on an order or invoice. A subscription order carries the discount as a line discount with
/// <c>DiscountCodeText = "Subscription discount"</c> and no discount-code id (a real code always has an id, so a customer cannot fake the label). The percentage
/// is the cycle's snapshotted <c>DiscountPercent</c>; if the cycle is not found the label is the plain text. Read-only; the amounts stay as the order froze them.
/// </summary>
internal static class SubscriptionDiscountLabels
{
    /// <summary>Order id -> label, only for the subscription orders among <paramref name="orderIds"/>.</summary>
    public static async Task<IReadOnlyDictionary<Guid, string>> ForOrdersAsync(AmarGramDbContext db, IReadOnlyCollection<Guid> orderIds)
    {
        if (orderIds.Count == 0) return new Dictionary<Guid, string>();

        var subscriptionOrders = await db.Orders.AsNoTracking()
            .Where(o => orderIds.Contains(o.Id) && o.DiscountCodeId == null && o.DiscountCodeText == SubscriptionMessages.DiscountLabel)
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
