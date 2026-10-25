using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-SUB-001 section 16 B and C (US-SUB-01 AC1, US-SUB-02) -- subscribing and controlling a subscription over real HTTP. Real Orders, Shop and Inventory behind it; every test mints
/// its own branch, SKU, stock, zone and customer (section 16.1). Adapted: no cat and no prescription diet (HO-P1) -- a product is subscribable when staff mark it so (BG-15).
/// </summary>
public sealed class SubscriptionsCustomerEndpointTests(OrderingApiFactory factory) : SubscriptionsIntegrationTestBase(factory)
{
    // ── B: subscribe ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task I_B1_TheOptions_OfASubscribableSku_NameTheIntervalsAndTheEarliestFirstDelivery()
    {
        var shop = await SetUpSubscribableShopAsync();

        var options = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/subscriptions/options?skuId={shop.Food.SkuId}")));

        Assert.True(options.GetProperty("subscribable").GetBoolean());
        Assert.Equal([2, 4, 6, 8, 12], options.GetProperty("allowedIntervalWeeks").EnumerateArray().Select(i => i.GetInt32()));
        Assert.Equal(20, options.GetProperty("maxQuantity").GetInt32());
        var cutoff = options.GetProperty("changeCutoffDays").GetInt32();
        Assert.Equal(Today.AddDays(cutoff + 1), DateOf(options, "earliestFirstDeliveryOn"));
        Assert.Equal(Today.AddDays(SubscriptionRules.MaxFirstDeliveryDays), DateOf(options, "latestFirstDeliveryOn"));
        Assert.Equal("Asia/Dhaka", options.GetProperty("commerceTimeZoneId").GetString());
        Assert.Equal(850m, AmountOf(options.GetProperty("unitPrice")));
    }

    [Fact]
    public async Task I_B3_AProductStaffDoNotOffer_IsNotSubscribable_WithTheReason()
    {
        var shop = await SetUpShopAsync(fillCart: false);   // the toy and the food are not flagged

        var options = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/subscriptions/options?skuId={shop.Toy.SkuId}")));
        Assert.False(options.GetProperty("subscribable").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(options.GetProperty("notSubscribableReason").GetString()));

        var messages = await RefusedAsync(await TrySubscribeAsync(shop, sku: shop.Toy), BusinessViolationCodes.SkuNotSubscribable);
        Assert.Contains(SubscriptionMessages.SkuNotSubscribableNotOffered, messages);
    }

    [Fact]
    public async Task I_B3b_AnUnknownSku_IsNotFound_AndAnArchivedProductIsNotSubscribable()
    {
        var shop = await SetUpSubscribableShopAsync();

        var unknown = await shop.Customer.PostAsJsonAsync("/api/customers/me/subscriptions", new
        { skuId = Guid.NewGuid(), quantity = 1, intervalWeeks = 4, fulfilment = "Delivery", deliveryAddressId = shop.AddressId, paymentMethod = "CashOnDelivery" }, Json);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);

        var detail = await ReadAsync(await shop.Context.Admin.GetAsync($"/api/staff/shop/products/{shop.Food.ProductId}"));
        await ExpectAsync(HttpStatusCode.NoContent, await shop.Context.Admin.PostAsJsonAsync($"/api/staff/shop/products/{shop.Food.ProductId}/archive",
            new { expectedVersion = detail.GetProperty("version").GetInt32() }, Json));

        var messages = await RefusedAsync(await TrySubscribeAsync(shop), BusinessViolationCodes.SkuNotSubscribable);
        Assert.Contains(SubscriptionMessages.SkuNotSubscribableInactive, messages);
    }

    [Fact]
    public async Task I_B2_Subscribing_SetsTheNextDelivery_ReturnsTheView_AndQueuesTheConfirmation()
    {
        var shop = await SetUpSubscribableShopAsync();

        var view = await SubscribeAsync(shop, quantity: 3, interval: 4);

        Assert.Equal("Active", view.GetProperty("status").GetString());
        Assert.Equal(Today.AddDays(3), DateOf(view, "nextDeliveryOn"));     // today + cut-off (2) + 1
        Assert.Equal(DateOf(view, "nextDeliveryOn"), DateOf(view, "startedOn"));
        Assert.Equal(3, view.GetProperty("terms").GetProperty("quantity").GetInt32());
        Assert.Equal("CashOnDelivery", view.GetProperty("terms").GetProperty("paymentMethod").GetString());
        Assert.False(view.GetProperty("isLocked").GetBoolean());
        Assert.Equal(["ChangeTerms", "Skip", "Pause", "Cancel"], AllowedActions(view));
        Assert.Equal("Asia/Dhaka", view.GetProperty("commerceTimeZoneId").GetString());
        Assert.Equal(850m * 3, AmountOf(view.GetProperty("estimate").GetProperty("subtotal")));
        Assert.Equal(shop.Food.Name, view.GetProperty("product").GetProperty("productName").GetString());

        var created = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCreated));
        Assert.Equal(AmarGram.Shared.Common.Enums.NotificationRecipientKind.Customer, created.RecipientKind);
        Assert.StartsWith("https://", created.Variables["manageLink"]);
        Assert.Contains("/portal/subscriptions/" + view.GetProperty("id").GetGuid(), created.Variables["manageLink"]);

        var list = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync("/api/customers/me/subscriptions?status=live")));
        Assert.Contains(list.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == view.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task I_B2b_AChosenFirstDate_IsHonoured_AndOneOutsideTheWindowIsRefused()
    {
        var shop = await SetUpSubscribableShopAsync();

        var tooSoon = await TrySubscribeAsync(shop, first: Today.AddDays(2));
        await AssertErrorAsync(tooSoon, BusinessViolationCodes.InvalidFirstDeliveryDate);
        var tooFar = await TrySubscribeAsync(shop, first: Today.AddDays(SubscriptionRules.MaxFirstDeliveryDays + 1));
        await AssertErrorAsync(tooFar, BusinessViolationCodes.InvalidFirstDeliveryDate);

        var view = await SubscribeAsync(shop, first: Today.AddDays(10));
        Assert.Equal(Today.AddDays(10), DateOf(view, "nextDeliveryOn"));
    }

    [Fact]
    public async Task I_B4_SubscribingToTheSameSkuTwice_IsRefused_AndTwentyParallelRequestsMakeExactlyOne()
    {
        var shop = await SetUpSubscribableShopAsync();
        await SubscribeAsync(shop);
        await AssertErrorAsync(await TrySubscribeAsync(shop), BusinessViolationCodes.SubscriptionAlreadyExists);

        var racing = await SetUpSubscribableShopAsync();
        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => TrySubscribeAsync(racing)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        foreach (var loser in responses.Where(r => r.StatusCode != HttpStatusCode.Created))
            await AssertErrorAsync(loser, BusinessViolationCodes.SubscriptionAlreadyExists);
    }

    [Fact]
    public async Task I_B5_AnotherCustomersAddress_IsDeliveryAddressNotFound()
    {
        var shop = await SetUpSubscribableShopAsync();
        var (other, _, _) = await RegisterAndSignInCustomerAsync();
        var theirs = await AddAddressAsync(other, shop.District);

        var refused = await shop.Customer.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food, addressId: theirs), Json);

        await AssertErrorAsync(refused, BusinessViolationCodes.DeliveryAddressNotFound);
    }

    [Fact]
    public async Task I_B6_CodAboveTheCeiling_IsRefusedWithOrdersReason_BankTransferIsAccepted()
    {
        var shop = await SetUpSubscribableShopAsync(codMax: 1000m);
        await SetBankTransferAccountAsync(shop.Context.Admin);

        var messages = await RefusedAsync(await TrySubscribeAsync(shop, quantity: 5), BusinessViolationCodes.PaymentMethodUnavailable);   // 5 x 850 is above the zone's COD ceiling
        Assert.All(messages, m => Assert.False(string.IsNullOrWhiteSpace(m)));

        var methods = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync(
            $"/api/customers/me/subscriptions/payment-methods?skuId={shop.Food.SkuId}&quantity=5&deliveryAddressId={shop.AddressId}")));
        Assert.False(methods.EnumerateArray().Single(m => m.GetProperty("method").GetString() == "CashOnDelivery").GetProperty("isAvailable").GetBoolean());
        Assert.True(methods.EnumerateArray().Single(m => m.GetProperty("method").GetString() == "BankTransfer").GetProperty("isAvailable").GetBoolean());

        var transfer = await TrySubscribeAsync(shop, quantity: 5, payment: "BankTransfer");
        Assert.Equal(HttpStatusCode.Created, transfer.StatusCode);
    }

    [Fact]
    public async Task APickupSubscription_PaidAtTheShop_IsAccepted_ButNotWithCashOnDelivery()
    {
        var shop = await SetUpSubscribableShopAsync();

        var codPickup = await shop.Customer.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food, payment: "CashOnDelivery", fulfilment: "Pickup"), Json);
        await AssertErrorAsync(codPickup, BusinessViolationCodes.PaymentMethodNotAllowedForFulfilment);

        var pickup = await shop.Customer.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food, payment: "PayAtPickup", fulfilment: "Pickup"), Json);
        await ExpectAsync(HttpStatusCode.Created, pickup);
        var view = await ReadAsync(pickup);
        Assert.Equal("Pickup", view.GetProperty("terms").GetProperty("fulfilment").GetString());
        Assert.Equal(shop.Context.BranchId, view.GetProperty("terms").GetProperty("pickupBranch").GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task I_B8_EveryCustomerRoute_NeedsACustomerSession_AndAnotherCustomersSubscriptionIs404()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();

        var guest = CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/customers/me/subscriptions")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync($"/api/customers/me/subscriptions/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, shop.Food), Json)).StatusCode);

        // A staff session is not a customer session.
        Assert.Equal(HttpStatusCode.Unauthorized, (await shop.Context.Admin.GetAsync("/api/customers/me/subscriptions")).StatusCode);

        var (other, _, _) = await RegisterAndSignInCustomerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/customers/me/subscriptions/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/customers/me/subscriptions/{id}/cycles")).StatusCode);
        foreach (var action in new[] { "pause", "resume" })
            Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(other, id, action)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/customers/me/subscriptions/{id}/pending-changes")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(other, id, "cancel", new { reason = "Other" })).StatusCode);

        var theirList = await ReadAsync(await other.GetAsync("/api/customers/me/subscriptions"));
        Assert.DoesNotContain(theirList.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == id);
        Assert.Equal("Active", (await GetAsync(shop.Customer, id)).GetProperty("status").GetString());   // untouched
    }

    // ── C: control ───────────────────────────────────────────────────────────────────────────────

    private static object TermsBody(JsonElement view, Shop shop, int? quantity = null, int? interval = null, string? payment = null) => new
    {
        version = view.GetProperty("version").GetInt32(),
        quantity = quantity ?? view.GetProperty("terms").GetProperty("quantity").GetInt32(),
        intervalWeeks = interval ?? view.GetProperty("terms").GetProperty("intervalWeeks").GetInt32(),
        fulfilment = "Delivery",
        deliveryAddressId = shop.AddressId,
        pickupBranchId = (Guid?)null,
        paymentMethod = payment ?? view.GetProperty("terms").GetProperty("paymentMethod").GetString(),
    };

    [Fact]
    public async Task I_C1_BeforeTheCutoff_AQuantityChange_AppliesToTheNextDelivery()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, quantity: 2);

        var response = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.PutAsJsonAsync(
            $"/api/customers/me/subscriptions/{view.GetProperty("id").GetGuid()}/terms", TermsBody(view, shop, quantity: 5), Json)));

        Assert.True(response.GetProperty("appliedImmediately").GetBoolean());
        Assert.Equal(DateOf(view, "nextDeliveryOn"), DateOf(response, "appliesFromCycleOn"));
        Assert.Equal(5, response.GetProperty("subscription").GetProperty("terms").GetProperty("quantity").GetInt32());
        Assert.Contains("5 ×", response.GetProperty("message").GetString());
        Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionChanged));
    }

    [Fact]
    public async Task I_C5_ChangingTermsWithAStaleVersion_Is409()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();
        var stale = TermsBody(view, shop, quantity: 3);

        await ExpectAsync(HttpStatusCode.OK, await shop.Customer.PutAsJsonAsync($"/api/customers/me/subscriptions/{id}/terms", stale, Json));
        var again = await shop.Customer.PutAsJsonAsync($"/api/customers/me/subscriptions/{id}/terms", stale, Json);   // the same screen, now out of date

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task I_C1b_ChangingToIdenticalTerms_IsNoChangeRequested_AndABadIntervalIsRefused()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();

        await AssertErrorAsync(await shop.Customer.PutAsJsonAsync($"/api/customers/me/subscriptions/{id}/terms", TermsBody(view, shop), Json), BusinessViolationCodes.NoChangeRequested);
        Assert.Equal(HttpStatusCode.BadRequest, (await shop.Customer.PutAsJsonAsync($"/api/customers/me/subscriptions/{id}/terms", TermsBody(view, shop, interval: 5), Json)).StatusCode);
    }

    [Fact]
    public async Task I_C2_BeforeTheCutoff_SkippingMovesTheDeliveryOneIntervalOn_AndAStaleLinkNamesTheNextDate()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, interval: 4);
        var id = view.GetProperty("id").GetGuid();
        var first = DateOf(view, "nextDeliveryOn");

        var skipped = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "skip", new { cycleOn = first })));
        Assert.True(skipped.GetProperty("appliedImmediately").GetBoolean());
        Assert.Equal(first.AddDays(28), DateOf(skipped.GetProperty("subscription"), "nextDeliveryOn"));

        // I-E4: the same link used again is refused specifically, naming the date that can still be skipped.
        var messages = await RefusedAsync(await PostAsync(shop.Customer, id, "skip", new { cycleOn = first }), BusinessViolationCodes.CycleNoLongerSkippable);
        Assert.Contains(SubscriptionMessages.Day(first.AddDays(28)), messages.Single());
    }

    [Fact]
    public async Task I_C3_PausingStopsTheSchedule_ResumingRestartsItOnTheEarliestDate()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();

        var paused = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "pause")));
        var pausedView = paused.GetProperty("subscription");
        Assert.Equal("Paused", pausedView.GetProperty("status").GetString());
        Assert.Null(OptionalDateOf(pausedView, "nextDeliveryOn"));
        Assert.Equal(["ChangeTerms", "Resume", "Cancel"], AllowedActions(pausedView));

        var resumed = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "resume")));
        Assert.Equal("Active", resumed.GetProperty("subscription").GetProperty("status").GetString());
        Assert.Equal(Today.AddDays(3), DateOf(resumed.GetProperty("subscription"), "nextDeliveryOn"));
    }

    [Fact]
    public async Task I_C4_Cancelling_StoresTheReason_QueuesTheMessage_AndEndsTheSubscription()
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop);
        var id = view.GetProperty("id").GetGuid();

        var cancelled = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "cancel", new { reason = "TooExpensive", note = "Too dear this month" })));

        var after = cancelled.GetProperty("subscription");
        Assert.Equal("Cancelled", after.GetProperty("status").GetString());
        Assert.Empty(AllowedActions(after));
        var stored = await WithDbAsync(db => db.Subscriptions.AsNoTracking().SingleAsync(s => s.Id == id));
        Assert.Equal(AmarGram.Shared.Common.Enums.SubscriptionCancellationReason.TooExpensive, stored.CancellationReason);
        var message = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCancelled));
        Assert.Equal("now", message.Variables["endsText"]);

        // A cancelled subscription no longer blocks a new one for the same SKU, and cannot be changed.
        await AssertErrorAsync(await PostAsync(shop.Customer, id, "pause"), BusinessViolationCodes.InvalidSubscriptionTransition);
        Assert.Equal(HttpStatusCode.Created, (await TrySubscribeAsync(shop)).StatusCode);
        var cancelledList = await ReadAsync(await shop.Customer.GetAsync("/api/customers/me/subscriptions?status=cancelled"));
        Assert.Contains(cancelledList.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == id);
    }

    [Fact]
    public async Task C4b_ACustomerMustChooseACustomerReason()
    {
        var shop = await SetUpSubscribableShopAsync();
        var id = (await SubscribeAsync(shop)).GetProperty("id").GetGuid();

        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(shop.Customer, id, "cancel", new { reason = "StaffCancelled" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(shop.Customer, id, "cancel", new { reason = "Nonsense" })).StatusCode);
        Assert.Equal("Active", (await GetAsync(shop.Customer, id)).GetProperty("status").GetString());
    }

    // ── C: after the cut-off (AC2) ───────────────────────────────────────────────────────────────

    /// <summary>A subscription whose next delivery is three days out, with the clock moved past its cut-off (local midnight two days before).</summary>
    private async Task<(Shop Shop, Guid Id, JsonElement View)> LockedSubscriptionAsync(int interval = 4)
    {
        var shop = await SetUpSubscribableShopAsync();
        var view = await SubscribeAsync(shop, interval: interval);
        AdvanceToLocal(DateOf(view, "nextDeliveryOn").AddDays(-2), hour: 1);
        var id = view.GetProperty("id").GetGuid();
        return (shop, id, await GetAsync(shop.Customer, id));
    }

    [Fact]
    public async Task I_C6_AfterTheCutoff_AQuantityChange_IsScheduledForTheFollowingDelivery_AndTheMessageNamesBothDates()
    {
        var (shop, id, locked) = await LockedSubscriptionAsync();
        Assert.True(locked.GetProperty("isLocked").GetBoolean());
        var next = DateOf(locked, "nextDeliveryOn");

        var response = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.PutAsJsonAsync(
            $"/api/customers/me/subscriptions/{id}/terms", TermsBody(locked, shop, quantity: 5), Json)));

        Assert.False(response.GetProperty("appliedImmediately").GetBoolean());
        Assert.Equal(next.AddDays(28), DateOf(response, "appliesFromCycleOn"));
        var message = response.GetProperty("message").GetString()!;
        Assert.Contains(SubscriptionMessages.Day(next), message);
        Assert.Contains(SubscriptionMessages.Day(next.AddDays(28)), message);
        var subscription = response.GetProperty("subscription");
        Assert.Equal(2, subscription.GetProperty("terms").GetProperty("quantity").GetInt32());          // today's order is not changed
        Assert.Equal(5, subscription.GetProperty("pending").GetProperty("terms").GetProperty("quantity").GetInt32());
        Assert.Contains("WithdrawPending", AllowedActions(subscription));

        // I-C9: withdrawing clears it; withdrawing again says there is nothing to withdraw.
        var withdrawn = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.DeleteAsync($"/api/customers/me/subscriptions/{id}/pending-changes")));
        Assert.False(withdrawn.GetProperty("subscription").TryGetProperty("pending", out var pending) && pending.ValueKind != System.Text.Json.JsonValueKind.Null);
        await AssertErrorAsync(await shop.Customer.DeleteAsync($"/api/customers/me/subscriptions/{id}/pending-changes"), BusinessViolationCodes.NoPendingChange);
    }

    [Fact]
    public async Task I_C8_AfterTheCutoff_SkippingTheNextDateIsRefused_TheFollowingOneIsScheduled()
    {
        var (shop, id, locked) = await LockedSubscriptionAsync();
        var next = DateOf(locked, "nextDeliveryOn");
        var following = DateOf(locked, "followingDeliveryOn");
        Assert.Equal(next.AddDays(28), following);
        Assert.Equal(following, DateOf(locked, "skippableCycleOn"));

        var messages = await RefusedAsync(await PostAsync(shop.Customer, id, "skip", new { cycleOn = next }), BusinessViolationCodes.CycleNoLongerSkippable);
        Assert.Contains(SubscriptionMessages.Day(following), messages.Single());

        var scheduled = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "skip", new { cycleOn = following })));
        Assert.False(scheduled.GetProperty("appliedImmediately").GetBoolean());
        Assert.True(scheduled.GetProperty("subscription").GetProperty("pending").GetProperty("skip").GetBoolean());
        Assert.Equal(next, DateOf(scheduled.GetProperty("subscription"), "nextDeliveryOn"));              // today's order still goes

        await AssertErrorAsync(await PostAsync(shop.Customer, id, "skip", new { cycleOn = following }), BusinessViolationCodes.SkipAlreadyScheduled);
    }

    [Fact]
    public async Task I_C10_AllowedActions_AreExactlyTheStatusMachinesSets()
    {
        var (shop, id, locked) = await LockedSubscriptionAsync();

        Assert.Equal(["ChangeTerms", "Skip", "Pause", "Cancel"], AllowedActions(locked));     // locked: the following delivery can still be skipped
        var pausing = await ReadAsync(await PostAsync(shop.Customer, id, "pause"));
        Assert.Equal(["ChangeTerms", "Cancel", "WithdrawPending"], AllowedActions(pausing.GetProperty("subscription")));   // a scheduled pause: no second pause, no skip
        var withdrawn = await ReadAsync(await shop.Customer.DeleteAsync($"/api/customers/me/subscriptions/{id}/pending-changes"));
        Assert.Equal(["ChangeTerms", "Skip", "Pause", "Cancel"], AllowedActions(withdrawn.GetProperty("subscription")));
    }

    [Fact]
    public async Task I_C7_AfterTheCutoff_CancellingIsScheduled_TheLockedDeliveryStillGoes()
    {
        var (shop, id, locked) = await LockedSubscriptionAsync();
        var next = DateOf(locked, "nextDeliveryOn");

        var cancelled = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await PostAsync(shop.Customer, id, "cancel", new { reason = "NoLongerNeeded" })));

        Assert.False(cancelled.GetProperty("appliedImmediately").GetBoolean());
        Assert.Equal(next, DateOf(cancelled, "appliesFromCycleOn"));
        Assert.Equal("Active", cancelled.GetProperty("subscription").GetProperty("status").GetString());
        Assert.Equal("Cancel", cancelled.GetProperty("subscription").GetProperty("pending").GetProperty("statusChange").GetString());
        var message = Assert.Single(await RequestsAsync(shop.CustomerId, NotificationTemplateCatalogue.SubscriptionCancelled));
        Assert.Equal("after your delivery on " + SubscriptionMessages.Day(next), message.Variables["endsText"]);
    }
}
