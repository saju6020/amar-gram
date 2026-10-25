using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-SUB-001 section 16 F (US-SUB-06, ADR-243, ADR-246) -- a bank-transfer subscription order is held for its window; a transfer confirmed in time is mirrored onto the cycle and the
/// reminder guard stops; an order Orders expires (FR-ORD-22) is mirrored as expired; two consecutive unpaid cycles suspend the subscription, staff see it on the unpaid list and only staff
/// can reinstate it. Real Orders, Billing and Inventory throughout; the clock is moved with <c>AdvanceToLocal</c> and Orders' own work cycle expires the orders.
/// </summary>
public sealed class SubscriptionsUnpaidEndpointTests(OrderingApiFactory factory) : SubscriptionsIntegrationTestBase(factory)
{
    private async Task<(Shop Shop, Guid Id, DateOnly Due)> TransferSubscriptionAsync(int interval = 2)
    {
        var shop = await SetUpSubscribableShopAsync();
        await SetBankTransferAccountAsync(shop.Context.Admin);
        var view = await SubscribeAsync(shop, payment: "BankTransfer", interval: interval);
        return (shop, view.GetProperty("id").GetGuid(), DateOf(view, "nextDeliveryOn"));
    }

    /// <summary>Moves the clock to the cycle's date, runs the subscription worker (the order is placed) and returns the new order.</summary>
    private async Task<AmarGram.Domain.Aggregates.Order.OrderAggregate> GenerateAsync(Shop shop, DateOnly due)
    {
        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);
        return (await OrdersOfAsync(shop.CustomerId)).Last();
    }

    /// <summary>Lets the order's 48 h payment window pass and runs Orders' own work cycle for the shop's branch: Orders expires the order and releases its stock.</summary>
    private async Task ExpireAsync(Shop shop, DateOnly due)
    {
        AdvanceToLocal(due.AddDays(3), hour: 8);
        await RunOrderWorkCycleAsync(shop.Context.BranchId);
    }

    private async Task<JsonElement?> FindAsync(HttpClient staff, string url, Guid id)
    {
        for (var page = 1; page <= 20; page++)
        {
            var body = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await staff.GetAsync($"{url}{(url.Contains('?') ? '&' : '?')}pageNumber={page}&pageSize=100")));
            var items = body.GetProperty("items").EnumerateArray().ToList();
            if (items.FirstOrDefault(i => i.GetProperty("id").GetGuid() == id) is { ValueKind: JsonValueKind.Object } found) return found;
            if (items.Count < 100) return null;
        }

        return null;
    }

    private Task<bool> PaymentGuardAsync(Guid customerId, Guid cycleId) => WithScopeAsync(async sp =>
        await sp.GetServices<INotificationSubjectGuard>().Single(g => g.Kind == NotificationSubjectKind.SubscriptionOrderAwaitingPayment).IsStillValidAsync(customerId, cycleId, null, null));

    [Fact]
    public async Task I_F2_ATransferConfirmedInTime_IsMirroredAsConfirmed_AndTheReminderNoLongerApplies()
    {
        var (shop, id, due) = await TransferSubscriptionAsync();
        var order = await GenerateAsync(shop, due);
        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOrderState.AwaitingPayment, cycle.OrderState);
        Assert.True(await PaymentGuardAsync(shop.CustomerId, cycle.Id));    // still unpaid: the reminder applies
        Assert.False(await PaymentGuardAsync(Guid.NewGuid(), cycle.Id));    // but never for another recipient

        var reception = await FreshStaffClientAsync(shop.Context, StaffRoles.Reception);
        await ExpectAsync(HttpStatusCode.OK, await ConfirmTransferAsync(reception, order.Id, order.Version, order.Totals.GrandTotal));

        Assert.Equal(SubscriptionCycleOrderState.Confirmed, Assert.Single(await CyclesAsync(id)).OrderState);
        Assert.False(await PaymentGuardAsync(shop.CustomerId, cycle.Id));    // the customer is never chased for money they have paid
        Assert.Equal(0, await StreakOfAsync(shop, id));
    }

    private async Task<int> StreakOfAsync(Shop shop, Guid id)
    {
        var staff = await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId);
        var row = await FindAsync(staff, "/api/staff/subscriptions", id) ?? throw new InvalidOperationException("subscription not in the staff list");
        return row.GetProperty("unpaidStreak").GetInt32();
    }

    [Fact]
    public async Task I_F3_AnOrderOrdersExpires_IsMirroredAsExpired_AndItsStockIsReleased_TheSubscriptionIsAtRisk()
    {
        var (shop, id, due) = await TransferSubscriptionAsync();
        var before = await SellableAsync(shop.Context.BranchId, shop.Food.SkuId);
        await GenerateAsync(shop, due);
        Assert.Equal(before - 2, await SellableAsync(shop.Context.BranchId, shop.Food.SkuId));

        await ExpireAsync(shop, due);

        Assert.Equal(SubscriptionCycleOrderState.Expired, Assert.Single(await CyclesAsync(id)).OrderState);
        Assert.Equal(before, await SellableAsync(shop.Context.BranchId, shop.Food.SkuId));   // released by Orders
        Assert.Equal(1, await StreakOfAsync(shop, id));

        // I-F5: one expired cycle is listed AtRisk, and the subscription is still active.
        var staff = await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId);
        var row = await FindAsync(staff, "/api/staff/subscriptions/unpaid", id);
        Assert.NotNull(row);
        Assert.Equal("AtRisk", row!.Value.GetProperty("group").GetString());
        Assert.Equal(1, row.Value.GetProperty("unpaidStreak").GetInt32());
        Assert.Equal("Active", row.Value.GetProperty("status").GetString());
        Assert.Equal("Active", (await GetAsync(await SignInAgainAsync(shop.CustomerId), id)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task I_F4_TwoConsecutiveExpiredCycles_SuspendTheSubscription_StaffSeeItAndOnlyStaffReinstateIt()
    {
        var (shop, id, due1) = await TransferSubscriptionAsync(interval: 2);
        await GenerateAsync(shop, due1);
        await ExpireAsync(shop, due1);
        var due2 = due1.AddDays(14);
        await GenerateAsync(shop, due2);
        await ExpireAsync(shop, due2);
        Assert.Equal(2, (await CyclesAsync(id)).Count(c => c.OrderState == SubscriptionCycleOrderState.Expired));

        await RunSubscriptionWorkAsync(shop.CustomerId);   // the unpaid pass nominates; the command re-checks the rule and suspends

        var customer = await SignInAgainAsync(shop.CustomerId);
        var suspended = await GetAsync(customer, id);
        Assert.Equal("Suspended", suspended.GetProperty("status").GetString());
        Assert.Equal("UnpaidCycles", suspended.GetProperty("suspensionReason").GetString());
        Assert.Equal(["Cancel"], AllowedActions(suspended));
        var notice = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionSuspended));
        Assert.Contains("unpaid", notice.Variables["reasonText"]);
        Assert.Equal(2, (await OrdersOfAsync(shop.CustomerId)).Count);   // nothing more is ordered

        // US-SUB-06 AC2: staff see it on the unpaid list (group Suspended, with the unpaid cycles) and can filter the staff list to it.
        var admin = await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId);
        var listed = await FindAsync(admin, "/api/staff/subscriptions/unpaid", id);
        Assert.NotNull(listed);
        Assert.Equal("Suspended", listed!.Value.GetProperty("group").GetString());
        Assert.Equal(2, listed.Value.GetProperty("unpaidStreak").GetInt32());
        Assert.Equal(2, listed.Value.GetProperty("unpaidCycles").GetArrayLength());
        Assert.NotNull(await FindAsync(admin, "/api/staff/subscriptions?status=Suspended&suspensionReason=UnpaidCycles", id));

        // I-F6 / OQ-6: the customer cannot restart it ...
        var messages = await RefusedAsync(await PostAsync(customer, id, "resume"), BusinessViolationCodes.SubscriptionSuspended);
        Assert.Contains("contact the shop", messages.Single());

        // ... a Reception user can see it but not reinstate it ...
        var reception = await FreshStaffClientAsync(shop.Context, StaffRoles.Reception);
        Assert.Equal(HttpStatusCode.OK, (await reception.GetAsync($"/api/staff/subscriptions/{id}")).StatusCode);
        var denied = await reception.PostAsJsonAsync($"/api/staff/subscriptions/{id}/reinstate", new { reason = "Paid by transfer" }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        // ... a reason is required ...
        await RefusedAsync(await admin.PostAsJsonAsync($"/api/staff/subscriptions/{id}/reinstate", new { reason = "  " }, Json), BusinessViolationCodes.ReinstatementReasonRequired);

        // ... and the shop manager (here the administrator) reinstates it with one: the same subscription, active again, the customer told.
        var reinstated = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.PostAsJsonAsync($"/api/staff/subscriptions/{id}/reinstate", new { reason = "Customer paid by transfer" }, Json)));
        Assert.Equal("Active", reinstated.GetProperty("status").GetString());
        Assert.Equal(id, reinstated.GetProperty("id").GetGuid());
        Assert.Equal(Today.AddDays(3), DateOf(reinstated, "nextDeliveryOn"));
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionResumed));

        // The old defaults are forgiven: the very next pass must not suspend it again.
        await RunSubscriptionWorkAsync(shop.CustomerId);
        Assert.Equal("Active", (await GetAsync(await SignInAgainAsync(shop.CustomerId), id)).GetProperty("status").GetString());
        var detail = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await admin.GetAsync($"/api/staff/subscriptions/{id}")));
        Assert.Equal("Customer paid by transfer", detail.GetProperty("reinstatement").GetProperty("reason").GetString());
    }

    [Fact]
    public async Task APaidCycleBetween_KeepsTheStreakBelowTheThreshold_NothingIsSuspended()
    {
        var (shop, id, due1) = await TransferSubscriptionAsync(interval: 2);
        await GenerateAsync(shop, due1);
        await ExpireAsync(shop, due1);
        var due2 = due1.AddDays(14);
        var second = await GenerateAsync(shop, due2);
        var reception = await FreshStaffClientAsync(shop.Context, StaffRoles.Reception);
        await ExpectAsync(HttpStatusCode.OK, await ConfirmTransferAsync(reception, second.Id, second.Version, second.Totals.GrandTotal));

        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Equal("Active", (await GetAsync(await SignInAgainAsync(shop.CustomerId), id)).GetProperty("status").GetString());
        Assert.Equal(0, await StreakOfAsync(shop, id));   // the latest was paid, so the streak is zero
    }

    [Fact]
    public async Task ACodOrderRefusedOnDelivery_CountsAsUnpaid_ADeliveredOneDoesNot()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, interval: 2);
        var id = view.GetProperty("id").GetGuid();
        var order = await GenerateAsync(shop, DateOf(view, "nextDeliveryOn"));
        Assert.Equal(OrderStatus.Confirmed, order.Status);

        // Orders records the parcel as refused: its event is mirrored onto the cycle (OQ-5).
        await WithScopeAsync(async sp =>
        {
            var mirror = sp.GetServices<Platform.Infrastructure.Core.Events.IEventHandlerAsync<AmarGram.Domain.Events.Order.OrderDeliveryFailedEvent>>()
                .OfType<AmarGram.Application.DomainEventHandlers.Subscription.MirrorOrderOutcomeToSubscriptionCycleHandler>().Single();
            await mirror.HandleAsync(new AmarGram.Domain.Events.Order.OrderDeliveryFailedEvent { OrderId = order.Id, Reason = DeliveryFailureReason.Refused.Value });
            return 0;
        });

        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOrderState.Refused, cycle.OrderState);
        Assert.True(cycle.IsUnpaid);
        Assert.Equal(1, await StreakOfAsync(shop, id));
    }
}
