using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.IntegrationTests;

/// <summary>
/// HO-P4 BG-1..BG-8 through real HTTP against the real Inventory, Shop and Billing: the dashboard sales series (BG-1), the order counts by status (BG-2), the area and slot on the
/// queue rows (BG-3), the Packed state and persisted pick ticks (BG-4), in-house riders and the cash-on-delivery-with-riders tile (BG-5), the POS browse grid (BG-6), the change
/// due on the quote (BG-7) and the anonymous walk-in sale (BG-8).
/// </summary>
public sealed class OrderingBackOfficeGapsEndpointTests(OrderingApiFactory factory) : OrderingShopTestBase(factory)
{
    private const decimal Total = 1097.50m; // 1 x food (850.00 + 15 % = 977.50) + 1 x toy (120.00 at 0 %)

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────────
    private async Task<Guid> CreateCourierAsync(OrderingContext context)
    {
        var response = await context.Admin.PostAsJsonAsync("/api/admin/couriers", new { name = "Courier " + Guid.NewGuid().ToString("N")[..8], supportsCod = true, isActive = true }, Json);
        await ExpectAsync(HttpStatusCode.Created, response);
        return (await ReadAsync(response)).GetProperty("courierId").GetGuid();
    }

    private async Task<Guid> CreateRiderAsync(HttpClient client, string? name = null, string? mobile = null, bool active = true)
    {
        var response = await client.PostAsJsonAsync("/api/staff/riders", new { name = name ?? "Rider " + Guid.NewGuid().ToString("N")[..8], mobileNumber = mobile, isActive = active }, Json);
        await ExpectAsync(HttpStatusCode.Created, response);
        return (await ReadAsync(response)).GetProperty("riderId").GetGuid();
    }

    private async Task<Guid> PlaceOrderAsync(Shop shop) => (await PlaceCodOrderAsync(shop)).GetProperty("orderId").GetGuid();

    private async Task<JsonElement> DetailAsync(HttpClient staff, Guid orderId) =>
        await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await staff.GetAsync($"/api/staff/orders/{orderId}")));

    private static string[] Allowed(JsonElement detail) => detail.GetProperty("allowedActions").EnumerateArray().Select(a => a.GetString()!).ToArray();

    private static JsonElement TileOf(JsonElement dashboard, string key) =>
        dashboard.GetProperty("tiles").EnumerateArray().Single(t => t.GetProperty("key").GetString() == key);

    private static JsonElement FigureOf(JsonElement tile, string key) =>
        tile.GetProperty("figures").EnumerateArray().Single(f => f.GetProperty("key").GetString() == key).GetProperty("value");

    private sealed record Till(Shop Shop, HttpClient Cashier, OrderingSku Food, OrderingSku Toy);

    private async Task<Till> TillAsync()
    {
        var shop = await SetUpShopAsync(fillCart: false);
        var food = await CreateSkuAsync(shop.Context, price: 850m, stock: 20m, food: true, name: "Basmati rice " + Guid.NewGuid().ToString("N")[..6]);
        var toy = await CreateSkuAsync(shop.Context, price: 120m, stock: 20m, taxClassId: shop.Context.ZeroTaxClassId, name: "Feather wand " + Guid.NewGuid().ToString("N")[..6]);
        var (cashier, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        return new Till(shop, cashier, food, toy);
    }

    private static object Lines(Till till) => new[] { new { skuId = till.Food.SkuId, quantity = 1 }, new { skuId = till.Toy.SkuId, quantity = 1 } };

    private static object Cash(decimal amount) => new { method = "Cash", amount };

    // ── BG-4: Packed and the pick ticks ──────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg4_AnOrderCanBePackedAndWaitForTheRider_ThenBeDispatched_AndTheLinesStayTickedAcrossReloads()
    {
        var shop = await SetUpShopAsync();
        var orderId = await PlaceOrderAsync(shop);
        var (reception, receptionId) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var courierId = await CreateCourierAsync(shop.Context);

        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{orderId}/packing", null));
        var packing = await DetailAsync(reception, orderId);
        Assert.Contains("MarkPacked", Allowed(packing));
        Assert.Contains("Dispatch", Allowed(packing)); // packed is an optional step: the straight-through path stays
        var lines = packing.GetProperty("lines").EnumerateArray().ToList();
        Assert.All(lines, l => Assert.False(l.GetProperty("picked").GetBoolean()));

        // tick one line; it is persisted with who and when, and survives a fresh read
        var first = lines[0].GetProperty("lineId").GetGuid();
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{first}/picked", new { picked = true }, Json));
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{first}/picked", new { picked = true }, Json)); // idempotent
        var ticked = (await DetailAsync(reception, orderId)).GetProperty("lines").EnumerateArray().ToList();
        Assert.True(ticked[0].GetProperty("picked").GetBoolean());
        Assert.Equal(receptionId, ticked[0].GetProperty("pickedBy").GetGuid());
        Assert.NotEqual(JsonValueKind.Null, ticked[0].GetProperty("pickedOn").ValueKind);
        Assert.False(ticked[1].GetProperty("picked").GetBoolean());

        await ExpectAsync(HttpStatusCode.NoContent, await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{first}/picked", new { picked = false }, Json));
        Assert.False((await DetailAsync(reception, orderId)).GetProperty("lines")[0].GetProperty("picked").GetBoolean());

        // Packing -> Packed
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{orderId}/packed", null));
        var packed = await DetailAsync(reception, orderId);
        Assert.Equal("Packed", packed.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, packed.GetProperty("packedOn").ValueKind);
        Assert.Equal(new[] { "Confirmed", "Packing", "Packed" }, packed.GetProperty("statusHistory").EnumerateArray().Select(h => h.GetProperty("to").GetString()));
        Assert.DoesNotContain("MarkPacked", Allowed(packed));
        Assert.Contains("Dispatch", Allowed(packed));
        Assert.Contains("Cancel", Allowed(packed));

        // ticks are still editable while it waits; Packed -> Dispatched
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{first}/picked", new { picked = true }, Json));
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { courierId, trackingNumber = "TRK-1" }, Json));
        var dispatched = await LoadOrderAsync(orderId);
        Assert.Equal(OrderStatus.Dispatched, dispatched.Status);
        Assert.True(dispatched.Lines.Single(l => l.Id == first).IsPicked);
    }

    [Fact]
    public async Task HoP4_Bg4_MarkPacked_IsRefusedFromAnyOtherState_PickTicksNeedKnownLinesAndFulfilRoles()
    {
        var shop = await SetUpShopAsync();
        var orderId = await PlaceOrderAsync(shop);
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var (inventory, _) = await StaffClientAsync(shop.Context, StaffRoles.Inventory);

        var early = await reception.PostAsync($"/api/staff/orders/{orderId}/packed", null);                   // still Confirmed
        await AssertErrorAsync(early, "InvalidOrderTransition");
        Assert.Contains("confirmed", await early.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var lineId = (await DetailAsync(reception, orderId)).GetProperty("lines")[0].GetProperty("lineId").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.PostAsync($"/api/staff/orders/{orderId}/packed", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{lineId}/picked", new { picked = true }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{Guid.NewGuid()}/picked", new { picked = true }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await reception.PostAsync($"/api/staff/orders/{Guid.NewGuid()}/packed", null)).StatusCode);

        // a Confirmed order may be ticked (the picker works before "Start packing")
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/lines/{lineId}/picked", new { picked = true }, Json));
    }

    [Fact]
    public async Task HoP4_Bg4_APackedOrder_CanBeCancelledByStaff_AndTheStockIsReleased()
    {
        var shop = await SetUpShopAsync();
        var orderId = await PlaceOrderAsync(shop);
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{orderId}/packing", null));
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{orderId}/packed", null));

        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/cancel", new { note = "Customer changed their mind" }, Json));

        Assert.Equal(OrderStatus.Cancelled, (await LoadOrderAsync(orderId)).Status);
    }

    // ── BG-2 / BG-3: counts by status; area and slot on the row ──────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg2_StatusCounts_ListEveryStatus_InPipelineOrder_UnderTheQueuesFilters()
    {
        var shop = await SetUpShopAsync();
        var first = await PlaceOrderAsync(shop);
        await ExpectAsync(HttpStatusCode.Created, await shop.Customer.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Food.SkuId, quantity = 1 }, Json));
        var second = await PlaceOrderAsync(shop);
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{first}/packing", null));

        var counts = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await reception.GetAsync("/api/staff/orders/status-counts")));
        Assert.Equal(2, counts.GetProperty("total").GetInt32());
        var byStatus = counts.GetProperty("counts").EnumerateArray().ToList();
        Assert.Equal(
            new[] { "PendingPayment", "Confirmed", "Packing", "Packed", "Dispatched", "Delivered", "Cancelled", "Returned", "Refunded" },
            byStatus.Select(c => c.GetProperty("status").GetString()));
        Assert.Equal(1, byStatus.Single(c => c.GetProperty("status").GetString() == "Confirmed").GetProperty("count").GetInt32());
        Assert.Equal(1, byStatus.Single(c => c.GetProperty("status").GetString() == "Packing").GetProperty("count").GetInt32());
        Assert.Equal(0, byStatus.Single(c => c.GetProperty("status").GetString() == "Delivered").GetProperty("count").GetInt32());

        // the queue's own filters narrow it: the same call as the list's totalCount
        var cod = await ReadAsync(await reception.GetAsync("/api/staff/orders/status-counts?paymentMethod=CashOnDelivery"));
        Assert.Equal(2, cod.GetProperty("total").GetInt32());
        var pickup = await ReadAsync(await reception.GetAsync("/api/staff/orders/status-counts?fulfilment=Pickup"));
        Assert.Equal(0, pickup.GetProperty("total").GetInt32());
        Assert.Equal(9, pickup.GetProperty("counts").GetArrayLength());
        var number = (await DetailAsync(reception, second)).GetProperty("orderNumber").GetString();
        var searched = await ReadAsync(await reception.GetAsync("/api/staff/orders/status-counts?search=" + number));
        Assert.Equal(1, searched.GetProperty("total").GetInt32());
        var list = await ReadAsync(await reception.GetAsync("/api/staff/orders?status=Confirmed"));
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest, (await reception.GetAsync("/api/staff/orders/status-counts?fulfilment=Teleport")).StatusCode);
    }

    [Fact]
    public async Task HoP4_Bg2_StatusCounts_AreForTheActiveBranchOnly_AndNeedOrdersView()
    {
        var shop = await SetUpShopAsync();
        await PlaceOrderAsync(shop);
        var other = await CreateContextAsync();
        var (otherReception, _) = await StaffClientAsync(other, StaffRoles.Reception);
        var (customerRoleless, _) = await StaffClientAsync(shop.Context, StaffRoles.Accountant); // Accountant holds Orders.View

        var empty = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await otherReception.GetAsync("/api/staff/orders/status-counts")));
        Assert.Equal(0, empty.GetProperty("total").GetInt32());
        Assert.Equal(1, (await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await customerRoleless.GetAsync("/api/staff/orders/status-counts")))).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient().GetAsync("/api/staff/orders/status-counts")).StatusCode);
    }

    [Fact]
    public async Task HoP4_Bg3_TheQueueRow_CarriesTheDeliveryAreaAndSlot()
    {
        var windows = Enum.GetNames<DayOfWeek>().Select(d => (object)new { dayOfWeek = d, start = "10:00", end = "13:00" }).ToArray();
        var shop = await SetUpShopAsync(windows: windows, lead: 1);
        await OpenBranchEveryDayAsync(shop.Context);
        var tomorrow = Today.AddDays(1).ToString("yyyy-MM-dd");

        await AcceptPendingPoliciesAsync(shop.Customer);
        var quote = await QuoteAsync(shop.Customer, QuoteUrl(shop, slotDate: tomorrow, slotStart: "10:00"));
        var placed = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await shop.Customer.SendAsync(PostOrder(PlaceBody(shop, quote, slotDate: tomorrow, slotStart: "10:00")))));
        var withSlot = placed.GetProperty("orderId").GetGuid();

        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        await ExpectAsync(HttpStatusCode.Created, await shop.Customer.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Toy.SkuId, quantity = 1 }, Json));
        var noSlot = await PlaceOrderAsync(shop);

        var list = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await reception.GetAsync("/api/staff/orders")));
        var rows = list.GetProperty("items").EnumerateArray().ToList();

        var slotted = rows.Single(r => r.GetProperty("id").GetGuid() == withSlot);
        Assert.Equal(tomorrow, slotted.GetProperty("slotDate").GetString());
        Assert.Equal("10:00–13:00", slotted.GetProperty("slotWindowLabel").GetString());
        Assert.Equal(shop.District, slotted.GetProperty("deliveryDistrict").GetString());
        var zoneName = await WithDbAsync(db => db.DeliveryZones.AsNoTracking().Where(z => z.Id == shop.ZoneId).Select(z => z.Name).SingleAsync());
        Assert.Equal(zoneName, slotted.GetProperty("deliveryZone").GetString());

        var plain = rows.Single(r => r.GetProperty("id").GetGuid() == noSlot);
        Assert.Equal(JsonValueKind.Null, plain.GetProperty("slotDate").ValueKind);
        Assert.Equal(JsonValueKind.Null, plain.GetProperty("slotWindowLabel").ValueKind);
        Assert.Equal(zoneName, plain.GetProperty("deliveryZone").GetString());
    }

    // ── BG-5: in-house riders ───────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg5_RidersAreStaffManagedPerBranch_NamesAreUniqueWithinABranch_AndAreNeverDeleted()
    {
        var shop = await SetUpShopAsync(fillCart: false);
        var other = await CreateContextAsync();
        var admin = shop.Context.Admin;
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);

        var riderId = await CreateRiderAsync(admin, name: "Karim Uddin", mobile: "017 1234-5678");
        var dup = await admin.PostAsJsonAsync("/api/staff/riders", new { name = "Karim Uddin", isActive = true }, Json);
        await AssertErrorAsync(dup, "RiderNameAlreadyExists");
        await CreateRiderAsync(other.Admin, name: "Karim Uddin"); // the same name at another branch is fine

        var list = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await reception.GetAsync("/api/staff/riders")));
        var rider = Assert.Single(list.EnumerateArray());
        Assert.Equal(riderId, rider.GetProperty("id").GetGuid());
        Assert.Equal("+8801712345678", rider.GetProperty("mobileNumber").GetString());
        Assert.True(rider.GetProperty("isActive").GetBoolean());

        // Reception may read the list to dispatch, but not manage it
        Assert.Equal(HttpStatusCode.Forbidden, (await reception.PostAsJsonAsync("/api/staff/riders", new { name = "Nope" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reception.PutAsJsonAsync($"/api/staff/riders/{riderId}", new { name = "Nope", isActive = true }, Json)).StatusCode);

        await AssertErrorAsync(await admin.PostAsJsonAsync("/api/staff/riders", new { name = "Bad Number", mobileNumber = "12345", isActive = true }, Json), "InvalidMobileNumber");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/staff/riders", new { name = "  ", isActive = true }, Json)).StatusCode);

        // deactivate: gone from the dispatch list (activeOnly), still in the full list
        await ExpectAsync(HttpStatusCode.NoContent, await admin.PutAsJsonAsync($"/api/staff/riders/{riderId}", new { name = "Karim U.", mobileNumber = (string?)null, isActive = false }, Json));
        Assert.Empty((await ReadAsync(await reception.GetAsync("/api/staff/riders?activeOnly=true"))).EnumerateArray());
        var all = (await ReadAsync(await reception.GetAsync("/api/staff/riders"))).EnumerateArray().Single();
        Assert.Equal("Karim U.", all.GetProperty("name").GetString());
        Assert.False(all.GetProperty("isActive").GetBoolean());

        // another branch's rider is not found for this branch
        Assert.Equal(HttpStatusCode.NotFound, (await other.Admin.PutAsJsonAsync($"/api/staff/riders/{riderId}", new { name = "Hijack", isActive = true }, Json)).StatusCode);
    }

    [Fact]
    public async Task HoP4_Bg5_AnOrderCanBeDispatchedToARider_NotBoth_AndNotToAnInactiveOrForeignRider()
    {
        var shop = await SetUpShopAsync();
        var other = await CreateContextAsync();
        var orderId = await PlaceOrderAsync(shop);
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var courierId = await CreateCourierAsync(shop.Context);
        var riderId = await CreateRiderAsync(shop.Context.Admin, name: "Rahim Rider");
        var inactive = await CreateRiderAsync(shop.Context.Admin, active: false);
        var foreign = await CreateRiderAsync(other.Admin);
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{orderId}/packing", null));

        await AssertErrorAsync(await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { courierId, riderId }, Json), "DispatchTargetInvalid");
        await AssertErrorAsync(await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { }, Json), "DispatchTargetInvalid");
        await AssertErrorAsync(await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { riderId, trackingNumber = "TRK-9" }, Json), "DispatchTargetInvalid");
        Assert.Equal(HttpStatusCode.NotFound, (await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { riderId = inactive }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { riderId = foreign }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { riderId = Guid.NewGuid() }, Json)).StatusCode);
        Assert.Equal(OrderStatus.Packing, (await LoadOrderAsync(orderId)).Status);

        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{orderId}/dispatch", new { riderId }, Json));

        var detail = await DetailAsync(reception, orderId);
        Assert.Equal("Dispatched", detail.GetProperty("status").GetString());
        var shipment = detail.GetProperty("shipment");
        Assert.Equal(riderId, shipment.GetProperty("riderId").GetGuid());
        Assert.Equal("Rahim Rider", shipment.GetProperty("riderName").GetString());
        Assert.Equal(JsonValueKind.Null, shipment.GetProperty("courierId").ValueKind);
        Assert.Equal(OrderRules.RiderCarrierName, shipment.GetProperty("courierName").GetString());

        // a rider delivery has no tracking number
        await AssertErrorAsync(await reception.PutAsJsonAsync($"/api/staff/orders/{orderId}/tracking", new { trackingNumber = "TRK-1" }, Json), "InvalidOrderTransition");

        // the customer sees the generic carrier, never the rider's name
        var mine = await shop.Customer.GetStringAsync($"/api/customers/me/orders/{orderId}");
        Assert.Contains(OrderRules.RiderCarrierName, mine);
        Assert.DoesNotContain("Rahim Rider", mine);
    }

    [Fact]
    public async Task HoP4_Bg5_TheDashboard_ShowsTheCashOnDeliveryOutWithRiders_UntilTheDeliveryIsRecorded()
    {
        var shop = await SetUpShopAsync();
        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var rider = await CreateRiderAsync(shop.Context.Admin, name: "Salam Rider");
        var courierId = await CreateCourierAsync(shop.Context);

        var none = TileOf(await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Context.Admin.GetAsync("/api/staff/dashboard"))), "orders.cod-with-riders");
        Assert.Equal(0, FigureOf(none, "riders").GetInt32());
        Assert.Equal("0.00", FigureOf(none, "amount").GetProperty("amount").GetString());

        var viaRider = await PlaceOrderAsync(shop);
        await ExpectAsync(HttpStatusCode.Created, await shop.Customer.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Toy.SkuId, quantity = 1 }, Json));
        var viaRider2 = await PlaceOrderAsync(shop);
        await ExpectAsync(HttpStatusCode.Created, await shop.Customer.PostAsJsonAsync("/api/cart/lines", new { skuId = shop.Toy.SkuId, quantity = 1 }, Json));
        var viaCourier = await PlaceOrderAsync(shop);
        foreach (var id in new[] { viaRider, viaRider2, viaCourier })
            await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsync($"/api/staff/orders/{id}/packing", null));

        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{viaRider}/dispatch", new { riderId = rider }, Json));
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{viaRider2}/dispatch", new { riderId = rider }, Json));
        await ExpectAsync(HttpStatusCode.NoContent, await reception.PostAsJsonAsync($"/api/staff/orders/{viaCourier}/dispatch", new { courierId }, Json)); // a courier's cash is not "with riders"

        var owed1 = (await LoadOrderAsync(viaRider)).BalanceDue;
        var owed2 = (await LoadOrderAsync(viaRider2)).BalanceDue;

        var out1 = TileOf(await ReadAsync(await shop.Context.Admin.GetAsync("/api/staff/dashboard")), "orders.cod-with-riders");
        Assert.Equal(1, FigureOf(out1, "riders").GetInt32());                  // distinct riders carrying cash
        Assert.Equal(2, FigureOf(out1, "orders").GetInt32());
        Assert.Equal(owed1 + owed2, AmountOf(FigureOf(out1, "amount")));

        // recording the first delivery (and its cash) takes it off the figure
        var version = (await LoadOrderAsync(viaRider)).Version;
        await ExpectAsync(HttpStatusCode.NoContent, await StaffPostAsync(reception, $"/api/staff/orders/{viaRider}/delivery",
            new { expectedVersion = version, deliveredOn = Now.AddMinutes(-1), codCollection = new { amount = owed1, collectorKind = "Courier", collectorName = "Salam Rider", collectedOn = Now.AddMinutes(-2) } }));

        var out2 = TileOf(await ReadAsync(await shop.Context.Admin.GetAsync("/api/staff/dashboard")), "orders.cod-with-riders");
        Assert.Equal(1, FigureOf(out2, "orders").GetInt32());
        Assert.Equal(owed2, AmountOf(FigureOf(out2, "amount")));

        // the Inventory role has no sales view, so no such tile
        var (inventory, _) = await StaffClientAsync(shop.Context, StaffRoles.Inventory);
        var keys = (await ReadAsync(await inventory.GetAsync("/api/staff/dashboard"))).GetProperty("tiles").EnumerateArray().Select(t => t.GetProperty("key").GetString());
        Assert.DoesNotContain("orders.cod-with-riders", keys);
    }

    // ── BG-6: POS browse ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg6_Browse_ListsSellableSkusByCategory_Paged_AndLeavesOutWhatCannotBeSold()
    {
        var shop = await SetUpShopAsync(fillCart: false);
        var (cashier, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var tag = "0000 Browse " + Guid.NewGuid().ToString("N")[..8];
        var rice = await CreateSkuAsync(shop.Context, price: 90m, stock: 7m, food: true, name: tag + " rice");
        var soap = await CreateSkuAsync(shop.Context, price: 40m, stock: 0m, name: tag + " soap");           // household, nothing on the shelf
        var draft = await CreateSkuAsync(shop.Context, price: 10m, stock: 3m, publish: false, name: tag + " draft");

        var riceGrid = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await cashier.GetAsync("/api/staff/pos/browse?category=RiceAndGrains&pageSize=100")));
        var riceItems = riceGrid.GetProperty("items").EnumerateArray().ToList();
        var riceRow = riceItems.Single(i => i.GetProperty("skuId").GetGuid() == rice.SkuId);
        Assert.Equal(7, riceRow.GetProperty("sellable").GetInt32());
        Assert.Equal("90.00", riceRow.GetProperty("unitPrice").GetProperty("amount").GetString());
        Assert.Equal(0, riceRow.GetProperty("fefoBatches").GetArrayLength());                 // the batch preview is for scan and search
        Assert.DoesNotContain(riceItems, i => i.GetProperty("skuId").GetGuid() == soap.SkuId); // another category
        Assert.Equal(1, riceGrid.GetProperty("pageNumber").GetInt32());

        var houseGrid = await ReadAsync(await cashier.GetAsync("/api/staff/pos/browse?category=HouseholdAndCare&pageSize=100"));
        var houseItems = houseGrid.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(0, houseItems.Single(i => i.GetProperty("skuId").GetGuid() == soap.SkuId).GetProperty("sellable").GetInt32()); // listed, with no stock
        Assert.DoesNotContain(houseItems, i => i.GetProperty("skuId").GetGuid() == draft.SkuId);                                     // unpublished: not sellable

        // no category = everything sellable; paging is real
        var everything = await ReadAsync(await cashier.GetAsync("/api/staff/pos/browse?pageSize=100"));
        Assert.Contains(everything.GetProperty("items").EnumerateArray(), i => i.GetProperty("skuId").GetGuid() == rice.SkuId);
        var page1 = await ReadAsync(await cashier.GetAsync("/api/staff/pos/browse?pageNumber=1&pageSize=1"));
        var page2 = await ReadAsync(await cashier.GetAsync("/api/staff/pos/browse?pageNumber=2&pageSize=1"));
        Assert.Equal(1, page1.GetProperty("items").GetArrayLength());
        Assert.Equal(1, page2.GetProperty("items").GetArrayLength());
        Assert.NotEqual(page1.GetProperty("items")[0].GetProperty("skuId").GetGuid(), page2.GetProperty("items")[0].GetProperty("skuId").GetGuid());
        Assert.True(page1.GetProperty("totalCount").GetInt32() >= 2);
        Assert.Equal(1, page1.GetProperty("pageSize").GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest, (await cashier.GetAsync("/api/staff/pos/browse?category=Teleporters")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cashier.GetAsync("/api/staff/pos/browse?pageSize=0")).StatusCode);
    }

    [Fact]
    public async Task HoP4_Bg6_Browse_IsForPosSellers_AndFollowsTheActiveBranchStock()
    {
        var till = await TillAsync();
        var other = await CreateContextAsync();
        var (inventory, _) = await StaffClientAsync(till.Shop.Context, StaffRoles.Inventory);
        var (otherCashier, _) = await StaffClientAsync(other, StaffRoles.Reception);

        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.GetAsync("/api/staff/pos/browse")).StatusCode);

        // the stock was received at the till's branch; another branch lists the SKU (it is sellable) with nothing on its shelf
        var ours = await ReadAsync(await till.Cashier.GetAsync("/api/staff/pos/browse?category=RiceAndGrains&pageSize=100"));
        Assert.Equal(20, ours.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("skuId").GetGuid() == till.Food.SkuId).GetProperty("sellable").GetInt32());
        var theirs = await ReadAsync(await otherCashier.GetAsync("/api/staff/pos/browse?category=RiceAndGrains&pageSize=100"));
        var foreignRow = theirs.GetProperty("items").EnumerateArray().FirstOrDefault(i => i.GetProperty("skuId").GetGuid() == till.Food.SkuId);
        if (foreignRow.ValueKind == JsonValueKind.Object) Assert.Equal(0, foreignRow.GetProperty("sellable").GetInt32());
    }

    // ── BG-7: change due on the quote ───────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg7_TheQuote_AnswersTheChangeDueForTheCashTendered_ByTheRuleTheSaleUses()
    {
        var till = await TillAsync();

        var plain = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = Lines(till) }, Json)));
        Assert.Equal(JsonValueKind.Null, plain.GetProperty("changeDue").ValueKind);
        Assert.Equal(JsonValueKind.Null, plain.GetProperty("cashShort").ValueKind);

        var over = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = Lines(till), tenderedCash = 1200m }, Json)));
        Assert.Equal("102.50", over.GetProperty("changeDue").GetProperty("amount").GetString());
        Assert.Equal(JsonValueKind.Null, over.GetProperty("cashShort").ValueKind);

        var exact = await ReadAsync(await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = Lines(till), tenderedCash = Total }, Json));
        Assert.Equal("0.00", exact.GetProperty("changeDue").GetProperty("amount").GetString());

        var under = await ReadAsync(await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = Lines(till), tenderedCash = 1000m }, Json));
        Assert.Equal(JsonValueKind.Null, under.GetProperty("changeDue").ValueKind);
        Assert.Equal("97.50", under.GetProperty("cashShort").GetProperty("amount").GetString());

        // completing the sale with that cash gives exactly the quoted change
        var sale = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { customerName = "Counter Customer", customerMobile = NewMobile(), lines = Lines(till), tenders = new[] { Cash(1200m) } })));
        Assert.Equal(over.GetProperty("changeDue").GetProperty("amount").GetString(), sale.GetProperty("changeDue").GetProperty("amount").GetString());
    }

    [Fact]
    public async Task HoP4_Bg7_TheQuote_RefusesAnAbsurdTenderedAmount_AndShowsNoChangeForASaleThatCannotBeMade()
    {
        var till = await TillAsync();

        foreach (var bad in new[] { 0m, -5m, 10_000_000_000m, 10.005m })
            Assert.Equal(HttpStatusCode.BadRequest, (await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = Lines(till), tenderedCash = bad }, Json)).StatusCode);

        var tooMany = new[] { new { skuId = till.Food.SkuId, quantity = 500 } };            // more than the 20 on the shelf: the quote cuts it down, and the sale would be refused
        var blocked = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Cashier.PostAsJsonAsync("/api/staff/pos/quote", new { lines = tooMany, tenderedCash = 999_999m }, Json)));
        Assert.Equal(JsonValueKind.Null, blocked.GetProperty("changeDue").ValueKind);
        Assert.Equal(JsonValueKind.Null, blocked.GetProperty("cashShort").ValueKind);
    }

    // ── BG-8: the anonymous walk-in sale ────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg8_ASaleWithNoNameOrMobile_HasNoCustomer_AndIsInvoicedToTheCounterSystemAccount()
    {
        var till = await TillAsync();

        var response = await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { lines = Lines(till), tenders = new[] { Cash(1200m) } }));
        var sale = await ReadAsync(response);
        Assert.Equal("102.50", sale.GetProperty("changeDue").GetProperty("amount").GetString());
        var order = await LoadOrderAsync(sale.GetProperty("orderId").GetGuid());

        Assert.Equal(OrderStatus.Delivered, order.Status);
        Assert.Equal(OrderChannel.Counter, order.Channel);
        Assert.Null(order.CustomerId);
        Assert.Equal("Walk-in customer", order.Fulfilment.RecipientName);
        Assert.Null(order.Fulfilment.RecipientPhone);
        Assert.Equal(Total, order.AmountPaid);

        var systemAccounts = await WithDbAsync(db => db.CustomerAccounts.AsNoTracking()
            .Where(c => c.MobileNumber!.Value == AnonymousCounterCustomer.NormalisedMobile).Select(c => new { c.Id, c.FullName, c.Status, HasPassword = c.PasswordCredential != null }).ToListAsync());
        var system = Assert.Single(systemAccounts);
        Assert.Equal(AnonymousCounterCustomer.FullName, system.FullName);
        Assert.Equal(CustomerAccountStatus.Active, system.Status);
        Assert.False(system.HasPassword);

        var invoice = await WithDbAsync(db => db.Invoices.AsNoTracking().Where(i => i.Id == order.InvoiceId).Select(i => new { i.CustomerId, i.Total, i.PaidTotal }).SingleAsync());
        Assert.Equal(system.Id, invoice.CustomerId);
        Assert.Equal(Total, invoice.PaidTotal);

        // stock left through the ledger as for any sale, with no customer stamped on the movement
        var entries = await WithDbAsync(db => db.StockLedgerEntries.AsNoTracking().Where(e => e.ReferenceId == order.Id).Select(e => new { e.Kind, e.CustomerId }).ToListAsync());
        Assert.Equal(2, entries.Count);
        Assert.All(entries, e => Assert.Equal(MovementKind.Sale, e.Kind));

        // the receipt prints without a customer name
        var receipt = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Cashier.GetAsync($"/api/staff/pos/sales/{order.Id}/receipt")));
        Assert.Equal(JsonValueKind.Null, receipt.GetProperty("customerName").ValueKind);
        Assert.Equal(sale.GetProperty("invoiceNumber").GetString(), receipt.GetProperty("invoiceNumber").GetString());

        // nobody is messaged about it
        Assert.Equal(0, await WithDbAsync(db => db.NotificationRequests.AsNoTracking().CountAsync(n => n.RecipientId == system.Id && n.TemplateKey.StartsWith("order."))));
    }

    [Fact]
    public async Task HoP4_Bg8_AnonymousSales_ShareOneSystemAccount_AndABlankedFieldCountsAsAbsent()
    {
        var till = await TillAsync();

        var a = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { customerName = "  ", customerMobile = "", lines = Lines(till), tenders = new[] { Cash(1100m) } })));
        var b = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { lines = Lines(till), tenders = new[] { Cash(1100m) } })));

        var orders = await WithDbAsync(db => db.Orders.AsNoTracking().Where(o => o.BranchId == till.Shop.Context.BranchId && o.Channel == OrderChannel.Counter).Select(o => new { o.Id, o.CustomerId, o.InvoiceId }).ToListAsync());
        Assert.Equal(2, orders.Count);
        Assert.All(orders, o => Assert.Null(o.CustomerId));
        var customers = await WithDbAsync(db => db.Invoices.AsNoTracking().Where(i => orders.Select(o => o.InvoiceId).Contains(i.Id)).Select(i => i.CustomerId).Distinct().ToListAsync());
        Assert.Single(customers);
        Assert.NotEqual(a.GetProperty("invoiceNumber").GetString(), b.GetProperty("invoiceNumber").GetString());
        Assert.Equal(1, await WithDbAsync(db => db.CustomerAccounts.AsNoTracking().CountAsync(c => c.MobileNumber!.Value == AnonymousCounterCustomer.NormalisedMobile)));
    }

    [Fact]
    public async Task HoP4_Bg8_TheBuyersDetailsComeTogetherOrNotAtAll_AndStillWorkAsBefore()
    {
        var till = await TillAsync();
        var lines = Lines(till);

        Assert.Equal(HttpStatusCode.BadRequest, (await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { customerName = "Only A Name", lines, tenders = new[] { Cash(1100m) } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { customerMobile = NewMobile(), lines, tenders = new[] { Cash(1100m) } })).StatusCode);

        var named = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { customerName = "Counter Customer", customerMobile = NewMobile(), lines, tenders = new[] { Cash(1100m) } })));
        Assert.NotNull((await LoadOrderAsync(named.GetProperty("orderId").GetGuid())).CustomerId);          // a named buyer is still a real customer
    }

    [Fact]
    public async Task HoP4_Bg8_ACodeLimitedPerCustomer_NeedsTheCustomersDetails_AnOrdinaryCodeStillWorks()
    {
        var till = await TillAsync();
        var (_, limited) = await CreateDiscountAsync(till.Shop.Context, perCustomerLimit: 1);
        var (_, ordinary) = await CreateDiscountAsync(till.Shop.Context, percent: 10m);

        await AssertErrorAsync(await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { lines = Lines(till), discountCode = limited, tenders = new[] { Cash(1200m) } }), "DiscountCustomerLimitReached");

        var ok = await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { lines = Lines(till), discountCode = ordinary, tenders = new[] { Cash(1200m) } })));
        Assert.Null((await LoadOrderAsync(ok.GetProperty("orderId").GetGuid())).CustomerId);

        // with a named buyer the limited code works as always
        await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { customerName = "Counter Customer", customerMobile = NewMobile(), lines = Lines(till), discountCode = limited, tenders = new[] { Cash(1200m) } }));
    }

    [Fact]
    public async Task HoP4_Bg8_NobodyCanTakeTheReservedNumber_AndTheSystemAccountCannotBeEdited()
    {
        var till = await TillAsync();
        await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { lines = Lines(till), tenders = new[] { Cash(1100m) } }));
        var systemId = await WithDbAsync(db => db.CustomerAccounts.AsNoTracking().Where(c => c.MobileNumber!.Value == AnonymousCounterCustomer.NormalisedMobile).Select(c => c.Id).SingleAsync());

        // an online customer cannot register the reserved number
        var client = CreateClient();
        var captcha = await client.PostAsync("/api/captcha", null);
        var captchaId = (await ReadAsync(captcha)).GetProperty("captchaId").GetString()!;
        var register = await client.PostAsJsonAsync("/api/customers",
            new { fullName = "Eve", mobileNumber = AnonymousCounterCustomer.Mobile, password = CustomerPassword, captchaId, captchaAnswer = "TEST1" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, register.StatusCode);                        // taken (the account exists now); before its first use the aggregate answers InvalidMobileNumber
        Assert.Contains("MobileNumberAlreadyRegistered", await ErrorCodesAsync(register));

        // a cashier cannot name it as a buyer either: that would put an order on the system account; nothing is created or changed
        var typed = await StaffPostAsync(till.Cashier, "/api/staff/pos/sales",
            new { customerName = "Somebody", customerMobile = AnonymousCounterCustomer.Mobile, lines = Lines(till), tenders = new[] { Cash(1100m) } });
        await AssertErrorAsync(typed, "InvalidMobileNumber");
        Assert.Equal(1, await WithDbAsync(db => db.CustomerAccounts.AsNoTracking().CountAsync(c => c.MobileNumber!.Value == AnonymousCounterCustomer.NormalisedMobile)));
        Assert.Equal(AnonymousCounterCustomer.FullName, await WithDbAsync(db => db.CustomerAccounts.AsNoTracking().Where(c => c.Id == systemId).Select(c => c.FullName).SingleAsync()));
    }

    // ── BG-1: the dashboard sales series ────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg1_TheSalesSeries_HasEveryDayOfTheLast14_WithTodaysNetAndOrderCount()
    {
        var till = await TillAsync();
        await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { lines = Lines(till), tenders = new[] { Cash(1100m) } }));

        var series = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Shop.Context.Admin.GetAsync("/api/staff/dashboard/sales-series")));
        Assert.Equal(till.Shop.Context.BranchId, series.GetProperty("branchId").GetGuid());
        Assert.Equal("BDT", series.GetProperty("currencyCode").GetString());
        var days = series.GetProperty("days").EnumerateArray().ToList();
        Assert.Equal(14, days.Count);
        Assert.Equal(Today.ToString("yyyy-MM-dd"), series.GetProperty("to").GetString());
        Assert.Equal(Today.AddDays(-13).ToString("yyyy-MM-dd"), series.GetProperty("from").GetString());
        Assert.Equal(Enumerable.Range(0, 14).Select(i => Today.AddDays(i - 13).ToString("yyyy-MM-dd")), days.Select(d => d.GetProperty("date").GetString()));

        var today = days[^1];
        Assert.Equal("970.00", today.GetProperty("net").GetProperty("amount").GetString());   // 850.00 + 120.00, tax excluded
        Assert.Equal(1, today.GetProperty("orders").GetInt32());
        Assert.All(days.Take(13), d => { Assert.Equal("0.00", d.GetProperty("net").GetProperty("amount").GetString()); Assert.Equal(0, d.GetProperty("orders").GetInt32()); });
        Assert.Equal("970.00", series.GetProperty("total").GetProperty("amount").GetString());

    }

    [Fact]
    public async Task HoP4_Bg1_TheSalesSeries_TakesDaysWithinBounds_IsBranchScoped_AndNeedsSalesView()
    {
        var till = await TillAsync();
        await ExpectAsync(HttpStatusCode.Created, await StaffPostAsync(till.Cashier, "/api/staff/pos/sales", new { lines = Lines(till), tenders = new[] { Cash(1100m) } }));
        var other = await CreateContextAsync();

        var week = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await till.Shop.Context.Admin.GetAsync("/api/staff/dashboard/sales-series?days=7")));
        Assert.Equal(7, week.GetProperty("days").GetArrayLength());

        var otherBranch = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await other.Admin.GetAsync("/api/staff/dashboard/sales-series")));
        Assert.Equal("0.00", otherBranch.GetProperty("total").GetProperty("amount").GetString());

        foreach (var bad in new[] { 0, 32, -1 })
            Assert.Equal(HttpStatusCode.BadRequest, (await till.Shop.Context.Admin.GetAsync($"/api/staff/dashboard/sales-series?days={bad}")).StatusCode);

        // Reception holds no report action
        Assert.Equal(HttpStatusCode.Forbidden, (await till.Cashier.GetAsync("/api/staff/dashboard/sales-series")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient().GetAsync("/api/staff/dashboard/sales-series")).StatusCode);
    }
}
