using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-SUB-001 section 16 D and E (US-SUB-01 AC2, US-SUB-03, US-SUB-04) -- when a cycle's date arrives the worker raises an <b>ordinary order through the real Orders</b> (real
/// Shop, Inventory and Billing behind it): stock is reserved by batch, a COD order is confirmed, a bank-transfer order is held with its payment window, and a retried or crashed
/// cycle never places a second order. The pre-charge notice goes once, before the cut-off. The tests call <c>SubscriptionWorkCycle</c> directly, restricted to their own customer.
/// </summary>
[Collection(AdministrationGlobalSettingsCollection.Name)]
public sealed class SubscriptionsGenerationEndpointTests(OrderingApiFactory factory) : SubscriptionsIntegrationTestBase(factory)
{
    private static readonly UserContext Worker = new(SystemActors.SubscriptionWorker, Guid.Empty) { UserName = "subscription-worker" };

    // ── D: generation ────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_D1_ACodSubscription_RaisesOneConfirmedSubscriptionOrder_WithStockReservedByBatch()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, quantity: 2, interval: 4);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");
        var before = await SellableAsync(shop.Context.BranchId, shop.Food.SkuId);

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Equal(OrderChannel.Subscription, order.Channel);
        Assert.Equal(OrderStatus.Confirmed, order.Status);
        Assert.Equal(OrderPaymentMethod.CashOnDelivery, order.PaymentMethod);
        Assert.Equal(SubscriptionKeys.OrderIdempotencyGuid(id, due), order.IdempotencyKey);
        Assert.Equal(2, order.Lines.Single().Quantity);
        Assert.Equal(before - 2, await SellableAsync(shop.Context.BranchId, shop.Food.SkuId));   // reserved by Inventory (FEFO), not by this slice
        Assert.True(order.IsFullyAllocated);
        Assert.NotEmpty(order.Lines.Single().Allocations);   // a batch was chosen (by Inventory), not by this slice

        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOutcome.Generated, cycle.Outcome);
        Assert.Equal(order.Id, cycle.OrderId);
        Assert.Equal(order.OrderNumber, cycle.OrderNumber);
        Assert.Equal(SubscriptionCycleOrderState.Confirmed, cycle.OrderState);
        Assert.Equal(SubscriptionKeys.IdempotencyKey(id, due), cycle.IdempotencyKey);

        var after = await GetAsync(shop.Customer, id);
        Assert.Equal(due.AddDays(28), DateOf(after, "nextDeliveryOn"));
        Assert.Equal("Generated", after.GetProperty("lastCycle").GetProperty("outcome").GetString());
        Assert.Equal(order.OrderNumber, after.GetProperty("lastCycle").GetProperty("orderNumber").GetString());

        // The customer's own order list shows the subscription order like any other.
        var orders = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync("/api/customers/me/orders")));
        Assert.Contains(orders.GetProperty("items").EnumerateArray(), o => o.GetProperty("id").GetGuid() == order.Id);
    }

    [Fact]
    public async Task I_D2_ABankTransferSubscription_HoldsTheOrderForItsWindow_AndQueuesTheReminderBeforeItCloses()
    {
        var shop = await SetUpSubscribableShopAsync();
        await SetBankTransferAccountAsync(shop.Context.Admin);
        var view = await SubscribeAsync(shop, payment: "BankTransfer");
        var id = view.GetProperty("id").GetGuid();

        AdvanceToLocal(DateOf(view, "nextDeliveryOn"));
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Equal(OrderStatus.PendingPayment, order.Status);
        Assert.Equal(OrderPaymentMethod.BankTransfer, order.PaymentMethod);
        Assert.NotNull(order.PaymentDueBy);

        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOrderState.AwaitingPayment, cycle.OrderState);
        Assert.Equal(order.PaymentDueBy, cycle.PaymentExpiresOn);

        var reminder = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionPaymentReminder));
        Assert.Equal(order.PaymentDueBy!.Value.AddHours(-24), reminder.SendAfter);
        Assert.Equal(order.PaymentDueBy, reminder.NotAfter);
        Assert.Equal(NotificationSubjectKind.SubscriptionOrderAwaitingPayment, reminder.SubjectKind);
        Assert.Equal(cycle.Id, reminder.SubjectId);
        Assert.EndsWith("/orders/" + order.Id, reminder.Variables["orderLink"].Split('?')[0].TrimEnd('/'));
    }

    [Fact]
    public async Task I_D3_RunningThePassTwice_PlacesExactlyOneOrder()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        AdvanceToLocal(DateOf(view, "nextDeliveryOn"));

        await RunSubscriptionWorkAsync(shop.CustomerId);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Single(await CyclesAsync(id));
    }

    [Fact]
    public async Task I_D3b_ACrashBetweenPlacingTheOrderAndRecordingTheCycle_IsRepairedByTheNextPass_WithTheSameOrder()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");
        AdvanceToLocal(due);

        // Scope 2 of the worker ran (the order is placed under the cycle's key) and the process died before scope 3 recorded the cycle.
        var crashedOrderId = Guid.NewGuid();
        await WithScopeAsync(async sp =>
        {
            var placed = await sp.GetRequiredService<IInMemoryDispatcher>().SendAsync(new PlaceSubscriptionOrderCommand
            {
                OrderId = crashedOrderId, SubscriptionId = id, CustomerId = shop.CustomerId, SkuId = shop.Food.SkuId, CycleOn = due, Quantity = 2,
                Fulfilment = SubscriptionFulfilment.Delivery, DeliveryAddressId = shop.AddressId, PaymentMethod = SubscriptionPaymentMethod.CashOnDelivery, DiscountPercent = 0m,
                UserContext = Worker, CorrelationId = Guid.NewGuid(), ValidateCommand = true,
            });
            Assert.True(placed.IsSuccess, string.Join(",", placed.ValidationResult?.Errors.Select(e => e.ErrorCode) ?? []));
            return 0;
        });
        Assert.Empty(await CyclesAsync(id));
        Assert.Single(await OrdersOfAsync(shop.CustomerId));

        await RunSubscriptionWorkAsync(shop.CustomerId);

        var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));   // still exactly one order: the key returned the original
        Assert.Equal(crashedOrderId, order.Id);
        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(crashedOrderId, cycle.OrderId);
        Assert.Equal(due.AddDays(28), DateOf(await GetAsync(shop.Customer, id), "nextDeliveryOn"));
    }

    [Fact]
    public async Task I_D3c_TwoWorkersRacingOnTheSameCycle_StillMakeOneOrderAndOneCycle()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        AdvanceToLocal(DateOf(view, "nextDeliveryOn"));

        await Task.WhenAll(RunSubscriptionWorkAsync(shop.CustomerId), RunSubscriptionWorkAsync(shop.CustomerId));
        await RunSubscriptionWorkAsync(shop.CustomerId);   // whatever the race left undone is finished by the next pass

        Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Single(await CyclesAsync(id));
    }

    [Fact]
    public async Task I_D4_WhenStockIsShort_TheCycleFails_TheCustomerIsTold_AndTheScheduleMovesOn()
    {
        var shop = await SetUpSubscribableShopAsync(stock: 1m);
        var view = await SubscribeAsync(shop, quantity: 2);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Empty(await OrdersOfAsync(shop.CustomerId));
        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOutcome.Failed, cycle.Outcome);
        Assert.Equal(SubscriptionCycleFailureReason.OutOfStock, cycle.FailureReason);
        Assert.NotNull(cycle.FailureCode);
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCycleFailed));

        var after = await GetAsync(shop.Customer, id);
        Assert.Equal("Active", after.GetProperty("status").GetString());                      // out of stock does not suspend (OQ-4)
        Assert.Equal(due.AddDays(28), DateOf(after, "nextDeliveryOn"));
        Assert.Equal("Failed", after.GetProperty("lastCycle").GetProperty("outcome").GetString());
        Assert.Equal("OutOfStock", after.GetProperty("lastCycle").GetProperty("failureReason").GetString());
    }

    [Fact]
    public async Task I_D5_TheSubscriberDiscount_IsALabelledDiscountOnTheOrder_SnapshottedOnTheCycle_AndLaterChangesDoNotTouchIt()
    {
        var shop = await SetUpSubscribableShopAsync();

        // The settings audit rows are stamped by this host's clock. Move it an hour on first, so they fall outside the +-5 minute window around real time that the
        // Administration settings audit test searches (it takes the latest row there), and sign the administrator in again at the new time.
        Factory.Clock.Advance(TimeSpan.FromHours(1));
        await SetSettingAsync(await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId), SettingKeys.SubscriptionDiscountPercent, "10");
        try
        {
            var view = await SubscribeAsync(shop, quantity: 2);
            Assert.Equal(10m, decimal.Parse(view.GetProperty("estimate").GetProperty("discountPercent").GetString()!, System.Globalization.CultureInfo.InvariantCulture));
            Assert.Equal(170m, AmountOf(view.GetProperty("estimate").GetProperty("discountAmount")));
            var id = view.GetProperty("id").GetGuid();

            AdvanceToLocal(DateOf(view, "nextDeliveryOn"));
            await RunSubscriptionWorkAsync(shop.CustomerId);

            var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));
            Assert.Equal(170m, order.Totals.LineDiscountTotal + order.Totals.OrderDiscount);   // 10 % of 2 x 850.00
            Assert.Equal(SubscriptionMessages.DiscountLabel, order.DiscountCodeText);
            Assert.Equal(10m, Assert.Single(await CyclesAsync(id)).DiscountPercent);

            // Owner decision 2026-11-09: the discount is named, not a bare line discount -- on the order (customer and staff views) and on the invoice.
            var customerOrder = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/orders/{order.Id}")));
            Assert.Equal("Subscription discount (10%)", customerOrder.GetProperty("lines")[0].GetProperty("discountLabel").GetString());
            Assert.Equal("Subscription discount (10%)", customerOrder.GetProperty("totals").GetProperty("lineDiscountLabel").GetString());
            var staffOrder = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await (await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId)).GetAsync($"/api/staff/orders/{order.Id}")));
            Assert.Equal("Subscription discount (10%)", staffOrder.GetProperty("totals").GetProperty("lineDiscountLabel").GetString());
            Assert.Equal(JsonValueKind.Null, staffOrder.GetProperty("discountCode").ValueKind);   // the label is not a discount code (owner wording fix 2026-11-09)

            var invoiceId = staffOrder.GetProperty("invoiceId");
            Assert.Equal(JsonValueKind.String, invoiceId.ValueKind);
            {
                var invoice = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await (await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId)).GetAsync($"/api/staff/billing/invoices/{invoiceId.GetGuid()}")));
                Assert.Equal("Subscription discount (10%)", invoice.GetProperty("totals").GetProperty("discountLabel").GetString());
                Assert.Contains(invoice.GetProperty("lines").EnumerateArray(), l => l.GetProperty("discountLabel").GetString() == "Subscription discount (10%)");
            }

            // I-D6: change the discount after generation -- the existing cycle and order keep 10 %. (The clock has moved days on: sign the administrator in again.)
            await SetSettingAsync(await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId), SettingKeys.SubscriptionDiscountPercent, "0");
            var reloaded = Assert.Single(await OrdersOfAsync(shop.CustomerId));
            Assert.Equal(170m, reloaded.Totals.LineDiscountTotal + reloaded.Totals.OrderDiscount);
            Assert.Equal(10m, Assert.Single(await CyclesAsync(id)).DiscountPercent);
        }
        finally
        {
            await SetSettingAsync(await SignInStaffAsync(shop.Context.AdminMobile, shop.Context.AdminPassword, shop.Context.BranchId), SettingKeys.SubscriptionDiscountPercent, "0");
        }
    }

    [Fact]
    public async Task I_D5b_AnOrderWithoutTheSubscriberDiscount_CarriesNoDiscountLabel()
    {
        var shop = await SetUpSubscribableShopAsync();   // the discount setting is 0 by default: no discount, so no label
        var view = await SubscribeAsync(shop);
        AdvanceToLocal(DateOf(view, "nextDeliveryOn"));
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));
        var customerOrder = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/orders/{order.Id}")));
        Assert.Equal(JsonValueKind.Null, customerOrder.GetProperty("totals").GetProperty("lineDiscountLabel").ValueKind);
        Assert.Equal(JsonValueKind.Null, customerOrder.GetProperty("lines")[0].GetProperty("discountLabel").ValueKind);
    }

    // -- Owner decision 2026-11-09: clearing "Can be subscribed to" never stops an existing subscription --

    [Fact]
    public async Task I_D8_ClearingTheSubscribableFlag_DoesNotStopAnExistingSubscription_ItsNextCycleStillRaisesItsOrder()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, quantity: 2, interval: 4);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");

        await SetSubscribableAsync(shop.Context, shop.Food, subscribable: false);

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var order = Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Equal(OrderChannel.Subscription, order.Channel);
        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleOutcome.Generated, cycle.Outcome);
        Assert.Equal(order.Id, cycle.OrderId);

        var after = await GetAsync(shop.Customer, id);
        Assert.Equal("Active", after.GetProperty("status").GetString());
        Assert.Equal(due.AddDays(28), DateOf(after, "nextDeliveryOn"));
    }

    [Fact]
    public async Task I_D8b_ClearingTheSubscribableFlag_StillRefusesANewSubscription()
    {
        var shop = await SetUpSubscribableShopAsync();
        await SetSubscribableAsync(shop.Context, shop.Food, subscribable: false);

        await RefusedAsync(await TrySubscribeAsync(shop), BusinessViolationCodes.SkuNotSubscribable);
    }

    [Fact]
    public async Task I_D7_AProductArchivedBeforeTheDate_FailsTheCycle_AndSuspendsTheSubscription()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var detail = await ReadAsync(await shop.Context.Admin.GetAsync($"/api/staff/shop/products/{shop.Food.ProductId}"));
        await ExpectAsync(HttpStatusCode.NoContent, await shop.Context.Admin.PostAsJsonAsync($"/api/staff/shop/products/{shop.Food.ProductId}/archive",
            new { expectedVersion = detail.GetProperty("version").GetInt32() }, Json));

        AdvanceToLocal(DateOf(view, "nextDeliveryOn"));
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleFailureReason.ProductUnavailable, cycle.FailureReason);
        var after = await GetAsync(shop.Customer, id);
        Assert.Equal("Suspended", after.GetProperty("status").GetString());
        Assert.Equal("ProductUnavailable", after.GetProperty("suspensionReason").GetString());
        Assert.Null(OptionalDateOf(after, "nextDeliveryOn"));
        Assert.Equal(["Cancel"], AllowedActions(after));
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCycleFailed));
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionSuspended));
        Assert.Empty(await OrdersOfAsync(shop.CustomerId));

        // I-F6: the customer cannot restart a suspension.
        await RefusedAsync(await PostAsync(shop.Customer, id, "resume"), BusinessViolationCodes.SubscriptionSuspended);
    }

    [Fact]
    public async Task I_D8_ADeliveryAddressRemovedBeforeTheDate_FailsTheCycle_ButTheSubscriptionStaysActive()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");
        await ExpectAsync(HttpStatusCode.NoContent, await shop.Customer.DeleteAsync($"/api/customers/me/addresses/{shop.AddressId}"));

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        var cycle = Assert.Single(await CyclesAsync(id));
        Assert.Equal(SubscriptionCycleFailureReason.DeliveryAddressMissing, cycle.FailureReason);
        Assert.Empty(await OrdersOfAsync(shop.CustomerId));
        var after = await GetAsync(shop.Customer, id);
        Assert.Equal("Active", after.GetProperty("status").GetString());
        Assert.True(after.GetProperty("terms").GetProperty("deliveryAddressMissing").GetBoolean());
        Assert.Equal(due.AddDays(28), DateOf(after, "nextDeliveryOn"));
    }

    [Fact]
    public async Task I_D1b_ALockedCancellation_StillRaisesTheCommittedOrder_ThenTheSubscriptionEnds()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");
        AdvanceToLocal(due.AddDays(-2), hour: 1);   // past the cut-off

        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "cancel", new { reason = "NoLongerNeeded" }));
        Assert.Empty(await OrdersOfAsync(shop.CustomerId));

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Single(await OrdersOfAsync(shop.CustomerId));   // the locked order still goes
        var after = await GetAsync(shop.Customer, id);
        Assert.Equal("Cancelled", after.GetProperty("status").GetString());
        Assert.Null(OptionalDateOf(after, "nextDeliveryOn"));
        await RunSubscriptionWorkAsync(shop.CustomerId);
        Assert.Single(await OrdersOfAsync(shop.CustomerId));   // and nothing after it
    }

    [Fact]
    public async Task APauseScheduledAfterTheCutoff_LetsTheLockedOrderGo_ThenPauses()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var due = DateOf(view, "nextDeliveryOn");
        AdvanceToLocal(due.AddDays(-2), hour: 1);
        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "pause"));

        AdvanceToLocal(due);
        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Single(await OrdersOfAsync(shop.CustomerId));
        Assert.Equal("Paused", (await GetAsync(shop.Customer, id)).GetProperty("status").GetString());
    }

    // ── E: the pre-charge notice (US-SUB-03) ─────────────────────────────────────────────────────

    [Fact]
    public async Task I_E1_TheNotice_GoesOnceThreeDaysBefore_WithASkipLinkForThatDate()
    {
        var shop = await SetUpSubscribableShopAsync();
        var due = Today.AddDays(10);
        var view = await SubscribeAsync(shop, quantity: 2, first: due);
        var id = view.GetProperty("id").GetGuid();

        AdvanceToLocal(due.AddDays(-4));
        await RunSubscriptionWorkAsync(shop.CustomerId);
        Assert.Empty(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionPreCharge));

        AdvanceToLocal(due.AddDays(-3));
        await RunSubscriptionWorkAsync(shop.CustomerId);
        await RunSubscriptionWorkAsync(shop.CustomerId);   // the same day again: no duplicate

        var notice = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionPreCharge));
        Assert.EndsWith($"/portal/subscriptions/{id}?skip={due:yyyy-MM-dd}", notice.Variables["skipLink"]);
        Assert.EndsWith($"/portal/subscriptions/{id}", notice.Variables["manageLink"]);
        Assert.Equal(SubscriptionMessages.Day(due), notice.Variables["deliveryOn"]);
        Assert.Contains("1,700.00", notice.Variables["estimatedAmount"]);
        Assert.Equal(NotificationSubjectKind.SubscriptionCycleDue, notice.SubjectKind);
        Assert.Equal(id, notice.SubjectId);
        Assert.Equal(due, notice.SubjectDueOn);
        Assert.Equal(new DateTimeOffset(due.AddDays(-2).ToDateTime(TimeOnly.MinValue), Dhaka), notice.NotAfter);   // never later than the cut-off
        Assert.Equal(SubscriptionKeys.NoticeDeduplicationKey(id, due), notice.DeduplicationKey);
    }

    [Fact]
    public async Task I_E3_SubscribingInsideTheNoticeWindow_SendsNoNotice_TheConfirmationAlreadyNamedTheDate()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);   // the earliest date is exactly three days out: the notice date is today

        await RunSubscriptionWorkAsync(shop.CustomerId);

        Assert.Empty(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionPreCharge));
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCreated));
        Assert.Equal("Active", (await GetAsync(shop.Customer, view.GetProperty("id").GetGuid())).GetProperty("status").GetString());
    }

    [Fact]
    public async Task I_E2_TheNoticeGuard_FailsOnceTheDeliveryHasMoved_OrIsPausedOrCancelled_OrForAnotherRecipient()
    {
        var shop = await SetUpSubscribableShopAsync();
        var due = Today.AddDays(10);
        var view = await SubscribeAsync(shop, first: due);
        var id = view.GetProperty("id").GetGuid();

        async Task<bool> ValidAsync(Guid recipient, DateOnly dueOn) => await WithScopeAsync(async sp =>
            await sp.GetServices<INotificationSubjectGuard>().Single(g => g.Kind == NotificationSubjectKind.SubscriptionCycleDue).IsStillValidAsync(recipient, id, null, dueOn));

        Assert.True(await ValidAsync(shop.CustomerId, due));
        Assert.False(await ValidAsync(Guid.NewGuid(), due));                       // another recipient

        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "skip", new { cycleOn = due }));
        Assert.False(await ValidAsync(shop.CustomerId, due));                       // skipped: the notice would offer a delivery that has moved

        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "pause"));
        Assert.False(await ValidAsync(shop.CustomerId, due.AddDays(28)));           // paused
        await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "cancel", new { reason = "Other" }));
        Assert.False(await ValidAsync(shop.CustomerId, due.AddDays(28)));           // cancelled
    }
}
