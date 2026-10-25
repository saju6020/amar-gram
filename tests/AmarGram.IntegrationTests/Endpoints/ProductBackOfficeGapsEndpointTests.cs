using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P4 BG-9 (staff list extras), BG-10 (bulk publish/hide), BG-13 (compare-at price) and BG-14 (organic certificate expiry and file),
/// through the real endpoints. Every assertion is scoped to the test's own products (a fresh brand each).</summary>
public sealed class ProductBackOfficeGapsEndpointTests(ShopApiFactory factory) : ShopIntegrationTestBase(factory)
{
    private static string NewBrand() => "Brand-" + Guid.NewGuid().ToString("N")[..10];

    /// <summary>An administrator assigned to the seeded main branch and naming it -- the "active branch" the list's stock figure is read at.</summary>
    private async Task<HttpClient> AdminAtMainBranchAsync()
    {
        var (staffId, mobile, password) = await SeedStaffAsync(StaffRoles.Administrator);
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var assignments = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<StaffBranchAssignmentAggregate>>();
            var assignment = new StaffBranchAssignmentAggregate(staffId);
            assignment.Assign(new AmarGram.Domain.Models.StaffBranchAssignDto(
                [AdministrationSeed.MainBranchId], AdministrationSeed.MainBranchId, new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
            await assignments.SaveAsync(assignment, EventPublishOption.InMemoryPublishOnly);
        }

        var client = await SignInStaffAsync(mobile, password);
        client.DefaultRequestHeaders.Add(AmarGram.Api.Branches.HttpContextActiveBranchAccessor.BranchHeaderName, AdministrationSeed.MainBranchId.ToString());
        return client;
    }

    private async Task<JsonElement> StaffRowAsync(HttpClient staff, string brand, Guid productId)
    {
        var list = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products?q={Uri.EscapeDataString(brand)}", Json);
        return list.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("productId").GetGuid() == productId);
    }

    private async Task<HttpResponseMessage> SchedulePriceRawAsync(HttpClient staff, Guid skuId, decimal amount, decimal? compareAt, DateTimeOffset? effectiveFrom = null) =>
        await staff.PostAsJsonAsync($"/api/staff/shop/skus/{skuId}/prices",
            new { amount, currencyCode = "BDT", effectiveFrom = effectiveFrom ?? DateTimeOffset.UtcNow, compareAtAmount = compareAt }, Json);

    private async Task<Guid> UploadAsync(HttpClient staff, string purpose, byte[] bytes, string fileName, string contentType)
    {
        using var form = new MultipartFormDataContent("b-" + Guid.NewGuid().ToString("N"));
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        form.Add(content, "file", fileName);
        var response = await staff.PostAsync($"/api/staff/files?purpose={purpose}", form);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("fileId").GetGuid();
    }

    private static byte[] Pdf() => "%PDF-1.4\n%%EOF"u8.ToArray();

    // ── BG-9 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task BG9_StaffListRow_CarriesOriginPackSizesPriceRangeStockThumbnailAndTheOrganicFlag()
    {
        var staff = await AdminAtMainBranchAsync();
        var brand = NewBrand();
        var product = await CreateProductAsync(staff, brand, "Brown rice", "RiceAndGrains", price: 180m, countryCode: "DE",
            certifications: ["CertifiedOrganic"], publish: false, stock: 0);

        // The first SKU becomes "1 kg"; a second, cheaper "500 g" SKU joins it.
        var update = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/skus/{product.SkuId}",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), sizeOrWeight = "1 kg" }, Json);
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);
        var add = await staff.PostAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/skus",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), code = UniqueCode("HALF"), sizeOrWeight = "500 g" }, Json);
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
        var halfSkuId = (await add.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("skuId").GetGuid();
        await SchedulePriceAsync(staff, halfSkuId, 100m);

        await StockSkuAsync(product.SkuId, 7m, expiryTracked: true);
        await StockSkuAsync(halfSkuId, 5m, expiryTracked: true);

        var imageId = await UploadAsync(staff, "ProductImage", TestImages.Png(), "rice.png", "image/png");
        var images = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/images", new
        {
            expectedVersion = await ProductVersionAsync(staff, product.ProductId),
            images = new[] { new { fileId = imageId, altText = "A bag of brown rice", sortOrder = 0, isPrimary = true } }
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, images.StatusCode);

        var row = await StaffRowAsync(staff, brand, product.ProductId);

        Assert.Equal("DE", row.GetProperty("countryOfOrigin").GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("countryOfOrigin").GetProperty("name").GetString()));
        // Cheapest first: the 500 g pack is 100, the 1 kg pack 180.
        Assert.Equal(["500 g", "1 kg"], row.GetProperty("packSizes").EnumerateArray().Select(s => s.GetString()).ToArray());
        Assert.Equal("100.00", row.GetProperty("priceRange").GetProperty("min").GetProperty("amount").GetString());
        Assert.Equal("180.00", row.GetProperty("priceRange").GetProperty("max").GetProperty("amount").GetString());
        Assert.Equal("BDT", row.GetProperty("priceRange").GetProperty("min").GetProperty("currencyCode").GetString());
        Assert.Equal(12m, row.GetProperty("availableStock").GetDecimal());
        Assert.Equal("A bag of brown rice", row.GetProperty("primaryImage").GetProperty("altText").GetString());
        Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("primaryImage").GetProperty("url").GetString()));
        Assert.True(row.GetProperty("isOrganic").GetBoolean());
        Assert.Equal(2, row.GetProperty("skuCount").GetInt32());
    }

    [Fact]
    public async Task BG9_ARowWithNothingToShow_HasEmptyExtras_NotMissingOnes()
    {
        var staff = await AdminAtMainBranchAsync();
        var brand = NewBrand();
        var product = await CreateProductAsync(staff, brand, "Plain jar", "HouseholdAndCare", price: 50m, publish: false, stock: 0);

        var row = await StaffRowAsync(staff, brand, product.ProductId);

        Assert.Equal(JsonValueKind.Null, row.GetProperty("countryOfOrigin").ValueKind);
        Assert.Empty(row.GetProperty("packSizes").EnumerateArray());
        Assert.Equal("50.00", row.GetProperty("priceRange").GetProperty("min").GetProperty("amount").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("availableStock").ValueKind);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("primaryImage").ValueKind);
        Assert.False(row.GetProperty("isOrganic").GetBoolean());
    }

    // ── BG-10 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static async Task<JsonElement> BulkAsync(HttpClient staff, string action, params Guid[] ids)
    {
        var response = await staff.PostAsJsonAsync("/api/staff/shop/products/bulk-status", new { productIds = ids, action }, Json);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {body}");
        return JsonSerializer.Deserialize<JsonElement>(body, Json);
    }

    private static JsonElement ItemOf(JsonElement result, Guid productId) =>
        result.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("productId").GetGuid() == productId);

    [Fact]
    public async Task BG10_BulkPublishThenHide_ReportsEachProduct_AndNeverNeedsAVersion()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = NewBrand();
        var ready = await CreateProductAsync(staff, brand, "Ready", publish: false, stock: 0);
        var alsoReady = await CreateProductAsync(staff, brand, "Also ready", publish: false, stock: 0);
        var unpriced = await CreateProductAsync(staff, brand, "Unpriced", publish: false, stock: 0);
        await MakeSkuUnpricedAsync(unpriced.SkuId);
        var missing = Guid.NewGuid();

        var published = await BulkAsync(staff, "Publish", ready.ProductId, alsoReady.ProductId, unpriced.ProductId, missing);

        Assert.Equal("Publish", published.GetProperty("action").GetString());
        Assert.Equal(2, published.GetProperty("succeededCount").GetInt32());
        Assert.Equal(2, published.GetProperty("failedCount").GetInt32());
        Assert.True(ItemOf(published, ready.ProductId).GetProperty("succeeded").GetBoolean());
        Assert.Equal("Active", ItemOf(published, ready.ProductId).GetProperty("status").GetString());
        Assert.Equal("ProductNotPublishable", ItemOf(published, unpriced.ProductId).GetProperty("errorCode").GetString());
        Assert.Contains(unpriced.SkuCode, ItemOf(published, unpriced.ProductId).GetProperty("message").GetString());
        Assert.Equal("ProductNotFound", ItemOf(published, missing).GetProperty("errorCode").GetString());
        Assert.Equal("Active", (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{alsoReady.ProductId}", Json)).GetProperty("status").GetString());
        Assert.Equal("Draft", (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{unpriced.ProductId}", Json)).GetProperty("status").GetString());

        // The published one is on the storefront; hiding takes it off again, and a Draft cannot be hidden.
        Assert.Equal(HttpStatusCode.OK, (await CreateClient().GetAsync($"/api/shop/products/{ready.Slug}")).StatusCode);
        var hidden = await BulkAsync(staff, "Unpublish", ready.ProductId, unpriced.ProductId);
        Assert.Equal(1, hidden.GetProperty("succeededCount").GetInt32());
        Assert.Equal("Draft", ItemOf(hidden, ready.ProductId).GetProperty("status").GetString());
        Assert.Equal("InvalidProductTransition", ItemOf(hidden, unpriced.ProductId).GetProperty("errorCode").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await CreateClient().GetAsync($"/api/shop/products/{ready.Slug}")).StatusCode);
        Assert.Equal("Active", (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{alsoReady.ProductId}", Json)).GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("Publish", 0)]
    [InlineData("Archive", 1)]
    [InlineData("Publish", 101)]
    public async Task BG10_BulkWithAnInvalidRequest_IsA400(string action, int count)
    {
        var staff = await SignInAsShopManagerAsync();

        var response = await staff.PostAsJsonAsync("/api/staff/shop/products/bulk-status",
            new { productIds = Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToArray(), action }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BG10_Bulk_NeedsTheProductsManageAction()
    {
        var (_, mobile, password) = await SeedStaffAsync("Reception");
        var reception = await SignInStaffAsync(mobile, password);

        var response = await reception.PostAsJsonAsync("/api/staff/shop/products/bulk-status", new { productIds = new[] { Guid.NewGuid() }, action = "Publish" }, Json);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── BG-13 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task BG13_CompareAtPrice_ShowsOnStaffSkuRows_PriceHistory_ShopDetailAndShopCatalogue()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = NewBrand();
        var product = await CreateProductAsync(staff, brand, "Sale item", price: 90m);

        var scheduled = await SchedulePriceRawAsync(staff, product.SkuId, 100m, 150m);
        Assert.Equal(HttpStatusCode.Created, scheduled.StatusCode);

        var staffDetail = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{product.ProductId}", Json);
        var skuRow = staffDetail.GetProperty("skus")[0];
        Assert.Equal("100.00", skuRow.GetProperty("currentPrice").GetProperty("amount").GetString());
        Assert.Equal("150.00", skuRow.GetProperty("compareAtPrice").GetProperty("amount").GetString());
        Assert.Equal("BDT", skuRow.GetProperty("compareAtPrice").GetProperty("currencyCode").GetString());

        var history = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/skus/{product.SkuId}/prices", Json);
        Assert.Equal("150.00", history.GetProperty("current").GetProperty("compareAtPrice").GetProperty("amount").GetString());
        Assert.Equal(JsonValueKind.Null, history.GetProperty("past")[0].GetProperty("compareAtPrice").ValueKind);

        var shopDetail = await CreateClient().GetFromJsonAsync<JsonElement>($"/api/shop/products/{product.Slug}", Json);
        var shopSku = shopDetail.GetProperty("skus")[0];
        Assert.Equal("100.00", shopSku.GetProperty("price").GetProperty("amount").GetString());
        Assert.Equal("150.00", shopSku.GetProperty("compareAtPrice").GetProperty("amount").GetString());

        var catalogue = await CreateClient().GetFromJsonAsync<JsonElement>($"/api/shop/products?brand={Uri.EscapeDataString(brand)}", Json);
        var card = Assert.Single(catalogue.GetProperty("items").EnumerateArray());
        Assert.Equal("100.00", card.GetProperty("fromPrice").GetProperty("amount").GetString());
        Assert.Equal("150.00", card.GetProperty("compareAtPrice").GetProperty("amount").GetString());
    }

    [Fact]
    public async Task BG13_APriceWithNoCompareAt_ShowsNone_AndEachSizeCardCarriesItsOwn()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = NewBrand();
        var product = await CreateProductAsync(staff, brand, "Two sizes", price: 100m);
        await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/skus/{product.SkuId}",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), sizeOrWeight = "500 g" }, Json);
        var add = await staff.PostAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/skus",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), code = UniqueCode("BIG"), sizeOrWeight = "1 kg" }, Json);
        var bigSkuId = (await add.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("skuId").GetGuid();
        // A SKU added to an active product starts inactive; price it with a "Was" price and reactivate.
        Assert.Equal(HttpStatusCode.Created, (await SchedulePriceRawAsync(staff, bigSkuId, 180m, 220m)).StatusCode);
        var reactivate = await staff.PostAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/skus/{bigSkuId}/reactivate",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId) }, Json);
        Assert.Equal(HttpStatusCode.NoContent, reactivate.StatusCode);

        var catalogue = await CreateClient().GetFromJsonAsync<JsonElement>($"/api/shop/products?brand={Uri.EscapeDataString(brand)}", Json);
        var cards = catalogue.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(2, cards.Count);
        var small = cards.Single(c => c.GetProperty("sizeLabel").GetString() == "500 g");
        var big = cards.Single(c => c.GetProperty("sizeLabel").GetString() == "1 kg");
        Assert.Equal(JsonValueKind.Null, small.GetProperty("compareAtPrice").ValueKind);
        Assert.Equal("220.00", big.GetProperty("compareAtPrice").GetProperty("amount").GetString());
    }

    [Theory]
    [InlineData(100, 100)]
    [InlineData(100, 99.5)]
    public async Task BG13_CompareAtNotAboveThePrice_IsRefused(double amount, double compareAt)
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Refused", price: 90m);

        var response = await SchedulePriceRawAsync(staff, product.SkuId, (decimal)amount, (decimal)compareAt);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("CompareAtMustExceedPrice", body.GetProperty("errors")[0].GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task BG13_AScheduledPriceKeepsItsOwnCompareAt_UntilItTakesEffect()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Later", price: 90m);

        var later = await SchedulePriceRawAsync(staff, product.SkuId, 110m, 140m, DateTimeOffset.UtcNow.AddDays(2));
        Assert.Equal(HttpStatusCode.Created, later.StatusCode);

        var sku = (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{product.ProductId}", Json)).GetProperty("skus")[0];
        Assert.Equal(JsonValueKind.Null, sku.GetProperty("compareAtPrice").ValueKind);
        Assert.Equal("140.00", sku.GetProperty("scheduledCompareAtPrice").GetProperty("amount").GetString());
    }

    // ── BG-14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private async Task<HttpResponseMessage> SetFoodAsync(HttpClient staff, Guid productId, DateOnly? expiresOn, Guid? fileId) =>
        await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/food", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId), ingredientList = "Organic rice",
            organicCertifier = "Test Organic Board", organicCertificateNumber = "ORG-1", organicCertificateExpiresOn = expiresOn, organicCertificateFileId = fileId
        }, Json);

    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public async Task BG14_ExpiryAndCertificateFile_AreStoredAndShownToStaffOnly()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Organic rice", "RiceAndGrains", certifications: ["CertifiedOrganic"], publish: false, stock: 0);
        var fileId = await UploadAsync(staff, "OrganicCertificate", Pdf(), "certificate.pdf", "application/pdf");
        var expires = UtcToday.AddMonths(8);

        var set = await SetFoodAsync(staff, product.ProductId, expires, fileId);
        Assert.True(set.StatusCode == HttpStatusCode.NoContent, await set.Content.ReadAsStringAsync());

        var food = (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{product.ProductId}", Json)).GetProperty("food");
        Assert.Equal(expires.ToString("yyyy-MM-dd"), food.GetProperty("organicCertificateExpiresOn").GetString());
        Assert.False(food.GetProperty("organicCertificateExpired").GetBoolean());
        Assert.Equal(fileId, food.GetProperty("organicCertificateFileId").GetGuid());
        Assert.False(string.IsNullOrWhiteSpace(food.GetProperty("organicCertificateUrl").GetString()));

        await PublishAsync(staff, product.ProductId);
        var publicFood = (await CreateClient().GetFromJsonAsync<JsonElement>($"/api/shop/products/{product.Slug}", Json)).GetProperty("food");
        Assert.False(publicFood.TryGetProperty("organicCertificateExpiresOn", out _));
        Assert.False(publicFood.TryGetProperty("organicCertificateFileId", out _));
        Assert.False(publicFood.TryGetProperty("organicCertificateUrl", out _));
    }

    [Fact]
    public async Task BG14_PublishingACertifiedOrganicProductWithAnExpiredCertificate_IsBlocked_UntilItIsRenewed()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Lapsed rice", "RiceAndGrains", certifications: ["CertifiedOrganic"], publish: false, stock: 0);
        Assert.Equal(HttpStatusCode.NoContent, (await SetFoodAsync(staff, product.ProductId, UtcToday.AddDays(-1), null)).StatusCode);

        var detail = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{product.ProductId}", Json);
        Assert.True(detail.GetProperty("food").GetProperty("organicCertificateExpired").GetBoolean());
        var item = detail.GetProperty("publishChecklist").EnumerateArray().Single(i => i.GetProperty("item").GetString() == "OrganicCertificateNotExpired");
        Assert.True(item.GetProperty("isBlocking").GetBoolean());
        Assert.False(item.GetProperty("isMet").GetBoolean());

        var blocked = await staff.PostAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/publish", new { expectedVersion = detail.GetProperty("version").GetInt32() }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, blocked.StatusCode);
        var body = await blocked.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("OrganicCertificateExpired", body.GetProperty("errors")[0].GetProperty("errorCode").GetString());

        // The bulk action reports the same code for that product.
        var bulk = await BulkAsync(staff, "Publish", product.ProductId);
        Assert.Equal("OrganicCertificateExpired", ItemOf(bulk, product.ProductId).GetProperty("errorCode").GetString());

        // Renewed: publishable.
        Assert.Equal(HttpStatusCode.NoContent, (await SetFoodAsync(staff, product.ProductId, UtcToday.AddYears(1), null)).StatusCode);
        await PublishAsync(staff, product.ProductId);
    }

    [Fact]
    public async Task BG14_ACertificateExpiringToday_StillPublishes()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Last day rice", "RiceAndGrains", certifications: ["CertifiedOrganic"], publish: false, stock: 0);
        Assert.Equal(HttpStatusCode.NoContent, (await SetFoodAsync(staff, product.ProductId, UtcToday, null)).StatusCode);

        await PublishAsync(staff, product.ProductId);
    }

    [Fact]
    public async Task BG14_AnUnknownOrWrongPurposeFile_IsRefused()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand(), "Bad file rice", "RiceAndGrains", certifications: ["CertifiedOrganic"], publish: false, stock: 0);

        var unknown = await SetFoodAsync(staff, product.ProductId, UtcToday.AddYears(1), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal("InvalidCertificateFile", (await unknown.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("errors")[0].GetProperty("errorCode").GetString());

        var image = await UploadAsync(staff, "ProductImage", TestImages.Png(), "x.png", "image/png");
        var wrongPurpose = await SetFoodAsync(staff, product.ProductId, UtcToday.AddYears(1), image);
        Assert.Equal(HttpStatusCode.BadRequest, wrongPurpose.StatusCode);
    }

    [Fact]
    public async Task BG14_ACertificateUpload_OnlyAcceptsDocumentsAndImages()
    {
        var staff = await SignInAsShopManagerAsync();

        using var form = new MultipartFormDataContent("b-" + Guid.NewGuid().ToString("N"));
        var content = new ByteArrayContent("a,b\n1,2\n"u8.ToArray());
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        form.Add(content, "file", "certificate.csv");

        var response = await staff.PostAsync("/api/staff/files?purpose=OrganicCertificate", form);

        Assert.NotEqual(HttpStatusCode.Created, response.StatusCode);
    }
}
