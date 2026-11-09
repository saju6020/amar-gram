using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P4 BG-16 (reorder level, batch received date and supplier), BG-17 (consignments arriving soon) and BG-18 (goods-receipt drafts, receiving
/// into another branch), through the real endpoints. Every test mints its own branch(es), so nothing can see another test's stock or drafts.</summary>
public sealed class InventoryBackOfficeGapsEndpointTests(InventoryApiFactory factory) : InventoryIntegrationTestBase(factory)
{
    private const string Drafts = "/api/staff/inventory/goods-receipt-drafts";

    // ── BG-16 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static async Task<JsonElement> SummaryRowAsync(HttpClient client, Guid skuId, string skuCode)
    {
        var body = await JsonOkAsync(await client.GetAsync($"/api/staff/inventory/stock?search={Uri.EscapeDataString(skuCode)}"));
        return body.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("skuId").GetGuid() == skuId);
    }

    [Fact]
    public async Task BG16_StockRow_CarriesTheReorderLevel_TheDefaultUntilAPolicyExists_ThenTheSumOfThePolicies()
    {
        var branch = await SeedBranchAsync();
        var sku = await CreateSkuAsync(branch.Admin.Client);
        await ReceiveAsync(branch.Admin.Client, sku.SkuId, branch.ShopId, 30m);

        var defaulted = await SummaryRowAsync(branch.Admin.Client, sku.SkuId, sku.SkuCode);
        Assert.Equal("10", defaulted.GetProperty("reorderLevel").GetString()); // inventory.defaultReorderPoint, once
        Assert.True(defaulted.GetProperty("reorderLevelIsDefault").GetBoolean());
        Assert.False(defaulted.GetProperty("belowReorderLevel").GetBoolean());

        foreach (var (location, point) in new[] { (branch.ShopId, 25m), (branch.WarehouseId, 40m) })
        {
            var set = await branch.Admin.Client.PutAsJsonAsync($"/api/staff/inventory/reorder-policies/{sku.SkuId}/{location}", new { reorderPoint = point }, Json);
            Assert.Equal(HttpStatusCode.NoContent, set.StatusCode);
        }

        var explicitRow = await SummaryRowAsync(branch.Admin.Client, sku.SkuId, sku.SkuCode);
        Assert.Equal("65", explicitRow.GetProperty("reorderLevel").GetString());
        Assert.False(explicitRow.GetProperty("reorderLevelIsDefault").GetBoolean());
        // 30 on hand at the shop against a point of 25: fine there; the empty warehouse pair is below 40.
        Assert.True(explicitRow.GetProperty("belowReorderLevel").GetBoolean());
    }

    [Fact]
    public async Task BG16_StockRow_AboveItsReorderPoint_IsNotFlagged()
    {
        var branch = await SeedBranchAsync();
        var sku = await CreateSkuAsync(branch.Admin.Client);
        await ReceiveAsync(branch.Admin.Client, sku.SkuId, branch.ShopId, 50m);
        await branch.Admin.Client.PutAsJsonAsync($"/api/staff/inventory/reorder-policies/{sku.SkuId}/{branch.ShopId}", new { reorderPoint = 20m }, Json);

        var row = await SummaryRowAsync(branch.Admin.Client, sku.SkuId, sku.SkuCode);

        Assert.Equal("20", row.GetProperty("reorderLevel").GetString());
        Assert.False(row.GetProperty("belowReorderLevel").GetBoolean());
    }

    [Fact]
    public async Task BG16_BatchMatrix_CarriesTheReceivedDateAndTheSupplier()
    {
        var branch = await SeedBranchAsync();
        var supplierId = await SeedSupplierAsync(branch.Admin.Client);
        var sku = await CreateSkuAsync(branch.Admin.Client);
        var withSupplier = await PostReceiptAsync(branch.Admin.Client, [ReceiptLine(sku.SkuId, branch.ShopId, 10m)], supplierId: supplierId);
        var withoutSupplier = await PostReceiptAsync(branch.Admin.Client, [ReceiptLine(sku.SkuId, branch.ShopId, 4m)]);

        var matrix = await JsonOkAsync(await branch.Admin.Client.GetAsync($"/api/staff/inventory/stock/{sku.SkuId}"));
        var batches = matrix.GetProperty("batches").EnumerateArray().ToList();

        var supplied = batches.Single(b => b.GetProperty("batchId").GetGuid() == withSupplier.BatchIds[0]);
        Assert.Equal(supplierId, supplied.GetProperty("supplierId").GetGuid());
        Assert.StartsWith("Supplier ", supplied.GetProperty("supplierName").GetString());
        Assert.True((DateTimeOffset.UtcNow - supplied.GetProperty("receivedOn").GetDateTimeOffset()).Duration() < TimeSpan.FromMinutes(5));

        var anonymous = batches.Single(b => b.GetProperty("batchId").GetGuid() == withoutSupplier.BatchIds[0]);
        Assert.Equal(JsonValueKind.Null, anonymous.GetProperty("supplierId").ValueKind);
        Assert.Equal(JsonValueKind.Null, anonymous.GetProperty("supplierName").ValueKind);
        Assert.Equal(JsonValueKind.String, anonymous.GetProperty("receivedOn").ValueKind);
    }

    // ── BG-17 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static async Task<Guid> PlanConsignmentAsync(HttpClient client, Guid supplierId, Guid warehouseId, Guid skuId, DateOnly? expectedArrivalOn)
    {
        var order = await SeedIssuedOrderAsync(client, supplierId, warehouseId, "USD", (skuId, 10m, 2m));
        var plan = await client.PostAsJsonAsync("/api/staff/procurement/consignments", new
        {
            originCountryCode = "DE", shipmentReference = "BL-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(), purchaseOrderIds = new[] { order.OrderId },
            importPermitNumber = "IP-1", healthCertificateNumber = "HC-1", customsDeclarationNumber = "CD-1", expectedArrivalOn
        }, Json);
        return (await JsonOkAsync(plan)).GetProperty("consignmentId").GetGuid();
    }

    private static async Task<JsonElement> AlertSummaryAsync(HttpClient client, string query = "") =>
        await JsonOkAsync(await client.GetAsync("/api/staff/inventory/alerts/summary" + query));

    [Fact]
    public async Task BG17_TheOverviewCountsConsignmentsDueWithinTheWindow_NotTheLateCancelledOrReceivedOnes()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;
        var supplierId = await SeedSupplierAsync(client);
        var sku = await CreateSkuAsync(client, food: true);

        Assert.Equal(0, (await AlertSummaryAsync(client)).GetProperty("consignmentsArriving").GetProperty("count").GetInt32());

        var inThreeDays = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, UtcToday.AddDays(3));
        var inSixDays = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, UtcToday.AddDays(6));
        var inThirtyDays = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, UtcToday.AddDays(30));
        var undated = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, null);
        var cancelled = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, UtcToday.AddDays(2));
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync($"/api/staff/procurement/consignments/{cancelled}/cancel", new { reason = "Supplier withdrew." }, Json)).StatusCode);

        var summary = await AlertSummaryAsync(client);
        Assert.Equal(7, summary.GetProperty("consignmentsArriving").GetProperty("withinDays").GetInt32());
        Assert.Equal(2, summary.GetProperty("consignmentsArriving").GetProperty("count").GetInt32());
        Assert.True(summary.TryGetProperty("open", out _)); // the badge the alert summary always carried

        var wider = await AlertSummaryAsync(client, "?arrivalWindowDays=45");
        Assert.Equal(45, wider.GetProperty("consignmentsArriving").GetProperty("withinDays").GetInt32());
        Assert.Equal(3, wider.GetProperty("consignmentsArriving").GetProperty("count").GetInt32());

        // The list filter answers the same set the tile counts.
        var list = await JsonOkAsync(await client.GetAsync("/api/staff/procurement/consignments?arrivingWithinDays=7"));
        Assert.Equal([inThreeDays, inSixDays], list.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).OrderBy(g => g == inSixDays).ToArray());
        Assert.DoesNotContain(list.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == inThirtyDays || i.GetProperty("id").GetGuid() == undated);
    }

    [Fact]
    public async Task BG17_AConsignmentWhoseGoodsHaveBeenReceived_NoLongerCounts()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;
        var supplierId = await SeedSupplierAsync(client);
        var sku = await CreateSkuAsync(client);
        var consignmentId = await PlanConsignmentAsync(client, supplierId, branch.WarehouseId, sku.SkuId, UtcToday.AddDays(2));
        Assert.Equal(1, (await AlertSummaryAsync(client)).GetProperty("consignmentsArriving").GetProperty("count").GetInt32());

        foreach (var to in new[] { "InTransit", "AtCustoms", "Cleared" })
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync($"/api/staff/procurement/consignments/{consignmentId}/status", new { to, on = UtcToday }, Json)).StatusCode);

        // Cleared is when it may be received -- still arriving until the receipt is posted.
        Assert.Equal(1, (await AlertSummaryAsync(client)).GetProperty("consignmentsArriving").GetProperty("count").GetInt32());

        await PostReceiptAsync(client, [ReceiptLine(sku.SkuId, branch.WarehouseId, 5m)], consignmentId: consignmentId);

        Assert.Equal(0, (await AlertSummaryAsync(client)).GetProperty("consignmentsArriving").GetProperty("count").GetInt32());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(91)]
    public async Task BG17_AnOutOfRangeWindow_IsA400(int days)
    {
        var branch = await SeedBranchAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await branch.Admin.Client.GetAsync($"/api/staff/inventory/alerts/summary?arrivalWindowDays={days}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await branch.Admin.Client.GetAsync($"/api/staff/procurement/consignments?arrivingWithinDays={days}")).StatusCode);
    }

    // ── BG-18: drafts ─────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static object DraftBody(Guid? branchId, Guid? supplierId, params object[] lines) =>
        new { branchId, supplierId, deliveryReference = "DN-" + Guid.NewGuid().ToString("N")[..6], note = "Truck was late", lines };

    private static object DraftLine(Guid skuId, Guid? locationId, decimal accepted = 6m, string? lot = null) =>
        new { skuId, locationId, quantityAccepted = accepted, quantityRejected = 0m, lotNumber = lot, holdForInspection = false };

    [Fact]
    public async Task BG18_ADraftIsSavedOverAndOver_ListedLoadedAndDiscarded()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;
        var sku = await CreateSkuAsync(client);
        var other = await CreateSkuAsync(client);
        var draftId = Guid.NewGuid();

        var first = await JsonOkAsync(await client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null, DraftLine(sku.SkuId, null, 0m)), Json));
        Assert.Equal(draftId, first.GetProperty("draftId").GetGuid());
        Assert.Equal(1, first.GetProperty("version").GetInt32());
        Assert.Equal(branch.BranchId, first.GetProperty("branchId").GetGuid());

        var second = await JsonOkAsync(await client.PutAsJsonAsync($"{Drafts}/{draftId}",
            DraftBody(null, null, DraftLine(sku.SkuId, branch.ShopId, 6m, "LOT-9"), DraftLine(other.SkuId, branch.WarehouseId, 2.5m)), Json));
        Assert.Equal(2, second.GetProperty("version").GetInt32());

        var loaded = await JsonOkAsync(await client.GetAsync($"{Drafts}/{draftId}"));
        Assert.Equal(branch.BranchId, loaded.GetProperty("branchId").GetGuid());
        Assert.Equal("Truck was late", loaded.GetProperty("note").GetString());
        var lines = loaded.GetProperty("lines").EnumerateArray().ToList();
        Assert.Equal(2, lines.Count);
        Assert.Equal(sku.SkuId, lines[0].GetProperty("skuId").GetGuid()); // the order they were typed in
        Assert.Equal(sku.SkuCode, lines[0].GetProperty("skuCode").GetString());
        Assert.Equal("LOT-9", lines[0].GetProperty("lotNumber").GetString());
        Assert.Equal(branch.ShopId, lines[0].GetProperty("locationId").GetGuid());
        Assert.Equal("6", lines[0].GetProperty("quantityAccepted").GetString());
        Assert.Equal("2.5", lines[1].GetProperty("quantityAccepted").GetString());

        var list = await JsonOkAsync(await client.GetAsync(Drafts));
        var row = Assert.Single(list.EnumerateArray(), d => d.GetProperty("draftId").GetGuid() == draftId);
        Assert.Equal(2, row.GetProperty("lineCount").GetInt32());
        Assert.Equal(2, row.GetProperty("version").GetInt32());
        Assert.Equal(branch.BranchId, row.GetProperty("branchId").GetGuid());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Drafts}/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Drafts}/{draftId}")).StatusCode);
        Assert.DoesNotContain((await JsonOkAsync(await client.GetAsync(Drafts))).EnumerateArray(), d => d.GetProperty("draftId").GetGuid() == draftId);

        // A late autosave from an old tab cannot bring it back; discarding again is harmless.
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Drafts}/{draftId}")).StatusCode);
    }

    [Fact]
    public async Task BG18_ADraftIsTheOwnersAlone()
    {
        var branch = await SeedBranchAsync();
        var keeper = await StaffAsync(branch, StaffRoles.Inventory);
        var colleague = await StaffAsync(branch, StaffRoles.Inventory);
        var draftId = Guid.NewGuid();
        await JsonOkAsync(await keeper.Client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null), Json));

        Assert.Equal(HttpStatusCode.NotFound, (await colleague.Client.GetAsync($"{Drafts}/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await colleague.Client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await colleague.Client.DeleteAsync($"{Drafts}/{draftId}")).StatusCode);
        Assert.Empty((await JsonOkAsync(await colleague.Client.GetAsync(Drafts))).EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, (await keeper.Client.GetAsync($"{Drafts}/{draftId}")).StatusCode);
    }

    [Fact]
    public async Task BG18_DraftsNeedTheReceiveAction()
    {
        var branch = await SeedBranchAsync();
        var accountant = await StaffAsync(branch, StaffRoles.Accountant);

        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.Client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", DraftBody(null, null), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.Client.GetAsync(Drafts)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient().GetAsync(Drafts)).StatusCode);
    }

    [Fact]
    public async Task BG18_AStaffMemberKeepsAtMostTwentyOpenDrafts()
    {
        var branch = await SeedBranchAsync();
        var keeper = await StaffAsync(branch, StaffRoles.Inventory);
        var drafts = Enumerable.Range(0, InventoryRules.MaxGoodsReceiptDraftsPerStaff).Select(_ => Guid.NewGuid()).ToList();
        foreach (var id in drafts)
            await JsonOkAsync(await keeper.Client.PutAsJsonAsync($"{Drafts}/{id}", DraftBody(null, null), Json));

        await AssertErrorAsync(await keeper.Client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", DraftBody(null, null), Json), BusinessViolationCodes.GoodsReceiptDraftLimitReached);

        // An existing draft still saves, and discarding one makes room.
        await JsonOkAsync(await keeper.Client.PutAsJsonAsync($"{Drafts}/{drafts[0]}", DraftBody(null, null), Json));
        await keeper.Client.DeleteAsync($"{Drafts}/{drafts[1]}");
        await JsonOkAsync(await keeper.Client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", DraftBody(null, null), Json));
    }

    [Fact]
    public async Task BG18_ADraftIsLenient_ButNotUnbounded()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;

        await JsonOkAsync(await client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", new { lines = new[] { new { skuId = Guid.NewGuid() } } }, Json));

        var negative = await client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", DraftBody(null, null, DraftLine(Guid.NewGuid(), null, -1m)), Json);
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);

        var tooMany = await client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}",
            DraftBody(null, null, Enumerable.Range(0, InventoryRules.MaxReceiptLines + 1).Select(_ => DraftLine(Guid.NewGuid(), null)).ToArray()), Json);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
    }

    [Fact]
    public async Task BG18_PostingAReceiptFromADraft_ClosesTheDraft()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;
        var sku = await CreateSkuAsync(client);
        var draftId = Guid.NewGuid();
        await JsonOkAsync(await client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null, DraftLine(sku.SkuId, branch.ShopId, 8m, "LOT-D")), Json));

        var post = await client.PostAsJsonAsync("/api/staff/inventory/goods-receipts", new { draftId, lines = new[] { ReceiptLine(sku.SkuId, branch.ShopId, 8m) } }, Json);
        await JsonOkAsync(post);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Drafts}/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null), Json)).StatusCode);
    }

    [Fact]
    public async Task BG18_AFailedPostLeavesTheDraftOpen()
    {
        var branch = await SeedBranchAsync();
        var client = branch.Admin.Client;
        var food = await CreateSkuAsync(client, food: true);
        var draftId = Guid.NewGuid();
        await JsonOkAsync(await client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(null, null, DraftLine(food.SkuId, branch.ShopId)), Json));

        // A food SKU with no expiry is refused when posting.
        var post = await client.PostAsJsonAsync("/api/staff/inventory/goods-receipts", new { draftId, lines = new[] { ReceiptLine(food.SkuId, branch.ShopId, 8m) } }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"{Drafts}/{draftId}")).StatusCode);
    }

    // ── BG-18: receiving into another branch ──────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task BG18_AReceiptCanBePostedIntoAnotherBranchTheStaffMemberIsAssignedTo()
    {
        var home = await SeedBranchAsync();
        var away = await SeedBranchAsync();
        var assign = await home.Admin.Client.PutAsJsonAsync($"/api/admin/staff/{home.Admin.StaffAccountId}/branches",
            new { branchIds = new[] { home.BranchId, away.BranchId }, primaryBranchId = home.BranchId }, Json);
        Assert.True(assign.StatusCode == HttpStatusCode.NoContent, await assign.Content.ReadAsStringAsync());
        var sku = await CreateSkuAsync(home.Admin.Client);

        // The receiving form lists the away branch's locations while the active branch is still the home one.
        var locations = await JsonOkAsync(await home.Admin.Client.GetAsync($"/api/staff/inventory/locations?branchId={away.BranchId}"));
        Assert.Contains(locations.EnumerateArray(), l => l.GetProperty("id").GetGuid() == away.ShopId);
        Assert.DoesNotContain(locations.EnumerateArray(), l => l.GetProperty("id").GetGuid() == home.ShopId);

        var post = await JsonOkAsync(await home.Admin.Client.PostAsJsonAsync("/api/staff/inventory/goods-receipts",
            new { branchId = away.BranchId, lines = new[] { ReceiptLine(sku.SkuId, away.ShopId, 12m) } }, Json));

        Assert.Equal(away.BranchId, post.GetProperty("branchId").GetGuid());
        var batchId = Assert.Single(post.GetProperty("batchIds").EnumerateArray()).GetGuid();
        Assert.Equal(12m, (await PositionAsync(batchId, away.ShopId)).OnHand);

        // The receipt belongs to the away branch: its history shows it, the home branch's does not.
        var receiptId = post.GetProperty("goodsReceiptId").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await home.Admin.Client.GetAsync($"/api/staff/inventory/goods-receipts/{receiptId}")).StatusCode);
        UseBranch(home.Admin.Client, away.BranchId);
        Assert.Equal(HttpStatusCode.OK, (await home.Admin.Client.GetAsync($"/api/staff/inventory/goods-receipts/{receiptId}")).StatusCode);
    }

    [Fact]
    public async Task BG18_AReceiptCannotBePostedIntoABranchTheStaffMemberIsNotAssignedTo()
    {
        var home = await SeedBranchAsync();
        var away = await SeedBranchAsync();
        var keeper = await StaffAsync(home, StaffRoles.Inventory);
        var sku = await CreateSkuAsync(home.Admin.Client);

        var post = await keeper.Client.PostAsJsonAsync("/api/staff/inventory/goods-receipts",
            new { branchId = away.BranchId, lines = new[] { ReceiptLine(sku.SkuId, away.ShopId, 3m) } }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, post.StatusCode);
        Assert.Contains("BranchNotAssigned", await post.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.Forbidden, (await keeper.Client.GetAsync($"/api/staff/inventory/locations?branchId={away.BranchId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await keeper.Client.PutAsJsonAsync($"{Drafts}/{Guid.NewGuid()}", DraftBody(away.BranchId, null), Json)).StatusCode);
    }

    [Fact]
    public async Task BG18_TheLocationsOfTheNamedBranchDecideTheReceipt()
    {
        var home = await SeedBranchAsync();
        var away = await SeedBranchAsync();
        await home.Admin.Client.PutAsJsonAsync($"/api/admin/staff/{home.Admin.StaffAccountId}/branches",
            new { branchIds = new[] { home.BranchId, away.BranchId }, primaryBranchId = home.BranchId }, Json);
        var sku = await CreateSkuAsync(home.Admin.Client);

        // A home-branch location is not a location of the away branch.
        var post = await home.Admin.Client.PostAsJsonAsync("/api/staff/inventory/goods-receipts",
            new { branchId = away.BranchId, lines = new[] { ReceiptLine(sku.SkuId, home.ShopId, 3m) } }, Json);

        await AssertErrorAsync(post, BusinessViolationCodes.StockLocationNotFound);
    }

    [Fact]
    public async Task BG18_ADraftRemembersTheBranchItWasStartedFor()
    {
        var home = await SeedBranchAsync();
        var away = await SeedBranchAsync();
        await home.Admin.Client.PutAsJsonAsync($"/api/admin/staff/{home.Admin.StaffAccountId}/branches",
            new { branchIds = new[] { home.BranchId, away.BranchId }, primaryBranchId = home.BranchId }, Json);
        var draftId = Guid.NewGuid();

        var saved = await JsonOkAsync(await home.Admin.Client.PutAsJsonAsync($"{Drafts}/{draftId}", DraftBody(away.BranchId, null), Json));
        Assert.Equal(away.BranchId, saved.GetProperty("branchId").GetGuid());

        Assert.Equal(away.BranchId, (await JsonOkAsync(await home.Admin.Client.GetAsync($"{Drafts}/{draftId}"))).GetProperty("branchId").GetGuid());
        var awayOnly = await JsonOkAsync(await home.Admin.Client.GetAsync($"{Drafts}?branchId={away.BranchId}"));
        Assert.Contains(awayOnly.EnumerateArray(), d => d.GetProperty("draftId").GetGuid() == draftId);
        var homeOnly = await JsonOkAsync(await home.Admin.Client.GetAsync($"{Drafts}?branchId={home.BranchId}"));
        Assert.DoesNotContain(homeOnly.EnumerateArray(), d => d.GetProperty("draftId").GetGuid() == draftId);
    }
}
