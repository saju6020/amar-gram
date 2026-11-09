using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-SHP-001-FU1 (backlog S1) -- the staff product detail returns what the staff forms
/// write: food labelling, images, health focus, SKU label. Tests FU1-T1, FU1-T1b and FU1-T2.</summary>
public sealed class ShopStaffProductDetailReadEndpointTests(ShopApiFactory factory) : ShopIntegrationTestBase(factory)
{
    private static byte[] MinimalPng() => TestImages.Png();

    private static async Task<Guid> UploadProductImageAsync(HttpClient staff)
    {
        using var form = new MultipartFormDataContent("test-boundary-" + Guid.NewGuid().ToString("N"));
        var part = new ByteArrayContent(MinimalPng());
        part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        form.Add(part, "file", "pouch.png");
        var response = await staff.PostAsync("/api/staff/files?purpose=ProductImage", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("fileId").GetGuid();
    }

    private async Task<(HttpClient Staff, Guid ProductId, Guid TaxClassId, Guid SkuId, string SkuCode, Guid FileId)> SeedFullFoodProductAsync()
    {
        var staff = await SignInAsShopManagerAsync();
        var taxClassId = await SeedActiveTaxClassAsync(UniqueCode("TAX"));
        var name = "Staff Read Food " + Guid.NewGuid().ToString("N")[..8];

        var create = await staff.PostAsJsonAsync("/api/staff/shop/products",
            new { kind = "Standard", name, brand = "Acme", category = "RiceAndGrains", taxClassId, slug = UniqueSlug("staff-read") }, Json);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var productId = (await create.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("productId").GetGuid();

        var details = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId), name, brand = "Acme", description = "A food.",
            category = "RiceAndGrains", taxClassId, countryOfOriginCode = "DE", tags = new[] { "stone-ground" },
            certifications = new[] { "PesticideFree", "Halal" }
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, details.StatusCode);

        var skuCode = UniqueCode("SKU");
        var addSku = await staff.PostAsJsonAsync($"/api/staff/shop/products/{productId}/skus", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId), code = skuCode,
            sizeOrWeight = "2 kg", flavour = "Aromatic", colour = "Red", packQuantity = 3
        }, Json);
        Assert.Equal(HttpStatusCode.Created, addSku.StatusCode);
        var skuId = (await addSku.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("skuId").GetGuid();

        var food = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/food", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId),
            ingredientList = "Basmati rice", storageInstructions = "Store in a cool, dry place.",
            shelfLife = "12 months", netWeight = "2 kg", allergens = "None",
            organicCertifier = "Bangladesh Organic Board", organicCertificateNumber = "BOB-1042"
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, food.StatusCode);

        var fileId = await UploadProductImageAsync(staff);
        var images = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/images", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId),
            images = new object[] { new { fileId, altText = "Front of pack", sortOrder = 0, isPrimary = true } }
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, images.StatusCode);

        return (staff, productId, taxClassId, skuId, skuCode, fileId);
    }

    [Fact]
    public async Task FU1_T1_StaffDetail_ReturnsFoodImagesCertificationsAndSkuLabelAndAttributes()
    {
        var (staff, productId, _, skuId, skuCode, fileId) = await SeedFullFoodProductAsync();

        var response = await staff.GetAsync($"/api/staff/shop/products/{productId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);

        var food = body.GetProperty("food");
        Assert.Equal("Basmati rice", food.GetProperty("ingredientList").GetString());
        Assert.Equal("Store in a cool, dry place.", food.GetProperty("storageInstructions").GetString());
        Assert.Equal("12 months", food.GetProperty("shelfLife").GetString());
        Assert.Equal("2 kg", food.GetProperty("netWeight").GetString());
        Assert.Equal("None", food.GetProperty("allergens").GetString());
        Assert.Equal("Bangladesh Organic Board", food.GetProperty("organicCertifier").GetString());
        Assert.Equal("BOB-1042", food.GetProperty("organicCertificateNumber").GetString());

        var certifications = body.GetProperty("certifications").EnumerateArray().Select(e => e.GetString()!).OrderBy(f => f).ToArray();
        Assert.Equal(new[] { "Halal", "PesticideFree" }, certifications);

        var image = Assert.Single(body.GetProperty("images").EnumerateArray());
        Assert.Equal(fileId, image.GetProperty("fileId").GetGuid());
        Assert.Equal("Front of pack", image.GetProperty("altText").GetString());
        Assert.Equal(0, image.GetProperty("sortOrder").GetInt32());
        Assert.True(image.GetProperty("isPrimary").GetBoolean());
        Assert.Equal(JsonValueKind.Null, image.GetProperty("skuId").ValueKind);

        var sku = Assert.Single(body.GetProperty("skus").EnumerateArray());
        Assert.Equal(skuId, sku.GetProperty("skuId").GetGuid());
        Assert.Equal(skuCode, sku.GetProperty("code").GetString());
        Assert.Equal("2 kg", sku.GetProperty("sizeOrWeight").GetString());
        Assert.Equal("Aromatic", sku.GetProperty("flavour").GetString());
        Assert.Equal("Red", sku.GetProperty("colour").GetString());
        Assert.Equal(3, sku.GetProperty("packQuantity").GetInt32());
        var label = sku.GetProperty("label").GetString()!;
        Assert.Contains("2 kg", label);
        Assert.Contains("Aromatic", label);
    }

    [Fact]
    public async Task FU1_T1b_StaffDetail_OfAProductWithNoFoodDetailsOrImages_ReturnsNullFoodAndEmptyLists()
    {
        var staff = await SignInAsShopManagerAsync();
        var taxClassId = await SeedActiveTaxClassAsync(UniqueCode("TAX"));
        var create = await staff.PostAsJsonAsync("/api/staff/shop/products",
            new { kind = "Standard", name = "Bare Product", brand = "Acme", category = "RiceAndGrains", taxClassId, slug = UniqueSlug("bare") }, Json);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var productId = (await create.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("productId").GetGuid();

        var body = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{productId}", Json);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("food").ValueKind);
        Assert.Empty(body.GetProperty("images").EnumerateArray());
        Assert.Empty(body.GetProperty("certifications").EnumerateArray());
    }

    [Fact]
    public async Task FU1_T2_RoundTrip_ReadThenResaveDetailsWithReturnedCertifications_PreservesThem_AndFoodAndImagesResaveUnchanged()
    {
        var (staff, productId, taxClassId, _, _, fileId) = await SeedFullFoodProductAsync();

        var before = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{productId}", Json);
        var returnedCertifications = before.GetProperty("certifications").EnumerateArray().Select(e => e.GetString()!).ToArray();
        Assert.Equal(2, returnedCertifications.Length);

        // The form's Details save: everything it loaded, certifications included.
        var details = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}", new
        {
            expectedVersion = before.GetProperty("version").GetInt32(),
            name = before.GetProperty("name").GetString(), brand = before.GetProperty("brand").GetString(),
            description = before.GetProperty("description").GetString(), category = before.GetProperty("category").GetString(),
            taxClassId, countryOfOriginCode = before.GetProperty("countryOfOriginCode").GetString(),
            listedOnStorefront = before.GetProperty("listedOnStorefront").GetBoolean(),
            isExpiryTracked = before.GetProperty("isExpiryTracked").GetBoolean(),
            tags = before.GetProperty("tags").EnumerateArray().Select(t => t.GetString()!).ToArray(),
            certifications = returnedCertifications
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, details.StatusCode);

        // The food form's save, from the returned food object.
        var food = (await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{productId}", Json)).GetProperty("food");
        var setFood = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/food", new
        {
            expectedVersion = await ProductVersionAsync(staff, productId),
            ingredientList = food.GetProperty("ingredientList").GetString(), storageInstructions = food.GetProperty("storageInstructions").GetString(),
            shelfLife = food.GetProperty("shelfLife").GetString(), netWeight = food.GetProperty("netWeight").GetString(),
            allergens = food.GetProperty("allergens").GetString(),
            organicCertifier = food.GetProperty("organicCertifier").GetString(),
            organicCertificateNumber = food.GetProperty("organicCertificateNumber").GetString()
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, setFood.StatusCode);

        // The images editor's save, from the returned images.
        var current = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{productId}", Json);
        var setImages = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/images", new
        {
            expectedVersion = current.GetProperty("version").GetInt32(),
            images = current.GetProperty("images").EnumerateArray().Select(i => new
            {
                fileId = i.GetProperty("fileId").GetGuid(), altText = i.GetProperty("altText").GetString(),
                sortOrder = i.GetProperty("sortOrder").GetInt32(), isPrimary = i.GetProperty("isPrimary").GetBoolean()
            }).ToArray()
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, setImages.StatusCode);

        var after = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{productId}", Json);
        Assert.Equal(returnedCertifications.OrderBy(f => f), after.GetProperty("certifications").EnumerateArray().Select(e => e.GetString()!).OrderBy(f => f));
        Assert.Equal("Bangladesh Organic Board", after.GetProperty("food").GetProperty("organicCertifier").GetString());
        Assert.Equal("2 kg", after.GetProperty("food").GetProperty("netWeight").GetString());
        Assert.Equal(fileId, Assert.Single(after.GetProperty("images").EnumerateArray()).GetProperty("fileId").GetGuid());
    }
}
