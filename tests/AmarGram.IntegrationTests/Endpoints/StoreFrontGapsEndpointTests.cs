using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using AmarGram.Shared.Common.Constants;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P3 G1 (district of origin: set, list item, detail, filter, facet), G8 (certifications on list items) through real HTTP.</summary>
public sealed class StoreFrontCatalogueGapsEndpointTests(ShopApiFactory factory) : ShopIntegrationTestBase(factory)
{
    private async Task<(Guid ProductId, string Slug)> CreateActiveProductAsync(
        HttpClient staff, string brand, string name, string? district, string[]? certifications = null)
    {
        var taxClassId = await SeedActiveTaxClassAsync(UniqueCode("TAX"));
        var slug = UniqueSlug(name.ToLowerInvariant().Replace(" ", "-"));

        var create = await staff.PostAsJsonAsync("/api/staff/shop/products", new { kind = "Standard", name, brand, category = "RiceAndGrains", taxClassId, slug }, Json);
        var productId = (await create.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("productId").GetGuid();

        var update = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}", new
        {
            expectedVersion = 1, name, brand, category = "RiceAndGrains", taxClassId, countryOfOriginCode = "BD", districtOfOrigin = district,
            certifications = certifications ?? [],
        }, Json);
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/food", new { expectedVersion = 2, ingredientList = "rice" }, Json);
        var addSku = await staff.PostAsJsonAsync($"/api/staff/shop/products/{productId}/skus", new { expectedVersion = 3, code = UniqueCode("SKU") }, Json);
        var skuId = (await addSku.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("skuId").GetGuid();
        await staff.PostAsJsonAsync($"/api/staff/shop/skus/{skuId}/prices", new { amount = 900m, currencyCode = "BDT", effectiveFrom = DateTimeOffset.UtcNow }, Json);

        var publish = await staff.PostAsJsonAsync($"/api/staff/shop/products/{productId}/publish", new { expectedVersion = 4 }, Json);
        Assert.Equal(HttpStatusCode.NoContent, publish.StatusCode);
        return (productId, slug);
    }

    private async Task<JsonElement> ListAsync(string query) =>
        await JsonOkAsync(await CreateClient().GetAsync("/api/shop/products?" + query));

    [Fact]
    public async Task G1_District_IsReturnedOnTheListItem_TheProductDetail_AndTheStaffDetail()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "DistrictBrand" + Guid.NewGuid().ToString("N")[..8];
        var (productId, slug) = await CreateActiveProductAsync(staff, brand, "Dinajpur Rice " + Guid.NewGuid().ToString("N")[..6], "  Dinajpur ");

        var item = (await ListAsync($"brand={Uri.EscapeDataString(brand)}")).GetProperty("items").EnumerateArray().Single();
        Assert.Equal("Dinajpur", item.GetProperty("districtOfOrigin").GetString());
        Assert.Equal("BD", item.GetProperty("countryOfOrigin").GetProperty("code").GetString());

        var detail = await JsonOkAsync(await CreateClient().GetAsync($"/api/shop/products/{slug}"));
        Assert.Equal("Dinajpur", detail.GetProperty("districtOfOrigin").GetString());

        var staffDetail = await JsonOkAsync(await staff.GetAsync($"/api/staff/shop/products/{productId}"));
        Assert.Equal("Dinajpur", staffDetail.GetProperty("districtOfOrigin").GetString());
    }

    [Fact]
    public async Task G1_ProductWithoutDistrict_ReturnsNull()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "NoDistrict" + Guid.NewGuid().ToString("N")[..8];
        await CreateActiveProductAsync(staff, brand, "Plain Rice " + Guid.NewGuid().ToString("N")[..6], null);

        var item = (await ListAsync($"brand={Uri.EscapeDataString(brand)}")).GetProperty("items").EnumerateArray().Single();
        Assert.Equal(JsonValueKind.Null, item.GetProperty("districtOfOrigin").ValueKind);
    }

    [Fact]
    public async Task G1_DistrictFilter_IsRepeatable_CaseInsensitive_AndCombinesWithOtherFilters()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "FilterDistrict" + Guid.NewGuid().ToString("N")[..8];
        var (dinajpur, _) = await CreateActiveProductAsync(staff, brand, "Dinajpur Rice " + Guid.NewGuid().ToString("N")[..6], "Dinajpur");
        var (rajshahi, _) = await CreateActiveProductAsync(staff, brand, "Rajshahi Rice " + Guid.NewGuid().ToString("N")[..6], "Rajshahi");
        var (bogura, _) = await CreateActiveProductAsync(staff, brand, "Bogura Rice " + Guid.NewGuid().ToString("N")[..6], "Bogura");
        var (none, _) = await CreateActiveProductAsync(staff, brand, "Unlabelled Rice " + Guid.NewGuid().ToString("N")[..6], null);

        async Task<List<Guid>> IdsAsync(string districts)
        {
            var body = await ListAsync($"brand={Uri.EscapeDataString(brand)}&{districts}");
            return body.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("productId").GetGuid()).ToList();
        }

        Assert.Equal([dinajpur], await IdsAsync("district=dinajpur"));

        var two = await IdsAsync("district=Dinajpur&district=Rajshahi");
        Assert.Equivalent(new[] { dinajpur, rajshahi }, two);
        Assert.DoesNotContain(bogura, two);
        Assert.DoesNotContain(none, two);

        var combined = await ListAsync($"brand={Uri.EscapeDataString(brand)}&district=Dinajpur&origin=BD");
        Assert.Equal("Dinajpur", combined.GetProperty("appliedFilters").GetProperty("district").GetString());
        Assert.Equal(1, combined.GetProperty("totalCount").GetInt32());

        Assert.Empty(await IdsAsync("district=Nowhere"));
    }

    [Fact]
    public async Task G1_DistrictFilter_RefusesTooManyOrTooLongValues()
    {
        var client = CreateClient();

        var tooLong = await client.GetAsync("/api/shop/products?district=" + new string('a', ProductRules.DistrictMaxLength + 1));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        var tooMany = await client.GetAsync("/api/shop/products?" + string.Join('&', Enumerable.Range(0, ShopSearchRules.MaxFilterValues + 1).Select(i => "district=d" + i)));
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
    }

    [Fact]
    public async Task G1_FiltersFacet_ListsDistrictsWithCounts()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "FacetDistrict" + Guid.NewGuid().ToString("N")[..8];
        var district = "Facet" + Guid.NewGuid().ToString("N")[..8];
        await CreateActiveProductAsync(staff, brand, "Facet Rice A " + Guid.NewGuid().ToString("N")[..6], district);
        await CreateActiveProductAsync(staff, brand, "Facet Rice B " + Guid.NewGuid().ToString("N")[..6], district.ToUpperInvariant());

        var filters = await JsonOkAsync(await CreateClient().GetAsync("/api/shop/filters?category=RiceAndGrains"));

        var match = filters.GetProperty("districts").EnumerateArray()
            .Where(d => string.Equals(d.GetProperty("value").GetString(), district, StringComparison.OrdinalIgnoreCase)).ToList();
        Assert.Single(match);
        Assert.Equal(2, match[0].GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task G1_DistrictOverTheMaximum_IsRefusedWhenStaffSetsIt()
    {
        var staff = await SignInAsShopManagerAsync();
        var taxClassId = await SeedActiveTaxClassAsync(UniqueCode("TAX"));
        var create = await staff.PostAsJsonAsync("/api/staff/shop/products",
            new { kind = "Standard", name = "Long District", brand = "Acme", category = "RiceAndGrains", taxClassId, slug = UniqueSlug("long-district") }, Json);
        var productId = (await create.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("productId").GetGuid();

        var update = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}", new
        {
            expectedVersion = 1, name = "Long District", brand = "Acme", category = "RiceAndGrains", taxClassId, districtOfOrigin = new string('a', ProductRules.DistrictMaxLength + 1),
        }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
    }

    [Fact]
    public async Task G8_ListItem_ReturnsCertificationNames_AsTheDetailDoes()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "CertBrand" + Guid.NewGuid().ToString("N")[..8];
        var (_, slug) = await CreateActiveProductAsync(staff, brand, "Certified Rice " + Guid.NewGuid().ToString("N")[..6], "Dinajpur", ["PesticideFree", "Halal"]);

        var item = (await ListAsync($"brand={Uri.EscapeDataString(brand)}")).GetProperty("items").EnumerateArray().Single();
        var onItem = item.GetProperty("certifications").EnumerateArray().Select(c => c.GetString()).OrderBy(c => c).ToList();
        Assert.Equal(["Halal", "PesticideFree"], onItem);

        var detail = await JsonOkAsync(await CreateClient().GetAsync($"/api/shop/products/{slug}"));
        Assert.Equal(onItem, detail.GetProperty("certifications").EnumerateArray().Select(c => c.GetString()).OrderBy(c => c).ToList());
    }

    [Fact]
    public async Task G8_ListItem_WithoutCertifications_ReturnsAnEmptyArray()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = "NoCert" + Guid.NewGuid().ToString("N")[..8];
        await CreateActiveProductAsync(staff, brand, "Plain Rice " + Guid.NewGuid().ToString("N")[..6], null);

        var item = (await ListAsync($"brand={Uri.EscapeDataString(brand)}")).GetProperty("items").EnumerateArray().Single();
        Assert.Equal(JsonValueKind.Array, item.GetProperty("certifications").ValueKind);
        Assert.Equal(0, item.GetProperty("certifications").GetArrayLength());
    }
}

/// <summary>HO-P3 G4 (the rider note at checkout) and G5 (the public delivery promise) through real HTTP.</summary>
public sealed class StoreFrontOrderingGapsEndpointTests(OrderingApiFactory factory) : OrderingShopTestBase(factory)
{
    // -- G4 --------------------------------------------------------------------------------------

    [Fact]
    public async Task G4_ARiderNote_IsStoredOnTheOrder_AndShownToTheCustomerAndStaff()
    {
        var shop = await SetUpShopAsync();
        await AcceptPendingPoliciesAsync(shop.Customer);
        var quote = await QuoteAsync(shop.Customer, QuoteUrl(shop));

        var response = await shop.Customer.SendAsync(PostOrder(PlaceBody(shop, quote, riderNote: "Please ring twice, the bell is faint.")));
        await ExpectAsync(HttpStatusCode.Created, response);
        var orderId = (await ReadAsync(response)).GetProperty("orderId").GetGuid();

        Assert.Equal("Please ring twice, the bell is faint.", (await LoadOrderAsync(orderId)).Fulfilment.RiderNote);

        var mine = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/orders/{orderId}")));
        Assert.Equal("Please ring twice, the bell is faint.", mine.GetProperty("fulfilment").GetProperty("riderNote").GetString());

        var (reception, _) = await StaffClientAsync(shop.Context, StaffRoles.Reception);
        var staff = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await reception.GetAsync($"/api/staff/orders/{orderId}")));
        Assert.Equal("Please ring twice, the bell is faint.", staff.GetProperty("fulfilment").GetProperty("riderNote").GetString());
    }

    [Fact]
    public async Task G4_NoRiderNote_ReturnsNull_AndDoesNotChangeTheAddressInstructions()
    {
        var shop = await SetUpShopAsync();
        var placed = await PlaceCodOrderAsync(shop);
        var orderId = placed.GetProperty("orderId").GetGuid();

        var mine = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await shop.Customer.GetAsync($"/api/customers/me/orders/{orderId}")));
        Assert.Equal(JsonValueKind.Null, mine.GetProperty("fulfilment").GetProperty("riderNote").ValueKind);
    }

    [Fact]
    public async Task G4_ARiderNoteOverTheLimit_IsRefused_AndNoOrderIsPlaced()
    {
        var shop = await SetUpShopAsync();
        await AcceptPendingPoliciesAsync(shop.Customer);
        var quote = await QuoteAsync(shop.Customer, QuoteUrl(shop));

        var response = await shop.Customer.SendAsync(PostOrder(PlaceBody(shop, quote, riderNote: new string('x', OrderRules.MaxRiderNoteLength + 1))));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // -- G5 --------------------------------------------------------------------------------------

    [Fact]
    public async Task G5_DeliveryPromise_IsPublic_AndMatchesTheQuoteTheCheckoutUses()
    {
        var shop = await SetUpShopAsync(freeOver: 3500m, lead: 2);
        var scoped = Factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Shop:StorefrontBranchId"] = shop.Context.BranchId.ToString() })));

        var anonymous = CreateClientOn(scoped);
        var response = await anonymous.GetAsync("/api/shop/delivery-promise");
        await ExpectAsync(HttpStatusCode.OK, response);
        Assert.Equal("public, max-age=60", response.Headers.CacheControl?.ToString());
        var promise = await ReadAsync(response);

        Assert.Equal("BDT", promise.GetProperty("currencyCode").GetString());
        Assert.Equal("3500.00", promise.GetProperty("freeOver").GetProperty("amount").GetString());
        Assert.Equal("BDT", promise.GetProperty("freeOver").GetProperty("currencyCode").GetString());
        Assert.Equal(2, promise.GetProperty("leadTimeDays").GetInt32());
        // Zone names are staff labels and stay private (HO-P3 SECURITY gate, LOW).
        Assert.False(promise.TryGetProperty("zoneName", out _));

        // the signed-in quote for the same zone says the same thing
        var quote = await QuoteAsync(shop.Customer, QuoteUrl(shop));
        var standard = quote.GetProperty("delivery").GetProperty("serviceLevels").EnumerateArray().First(l => l.GetProperty("level").GetString() == "Standard");
        Assert.Equal("3500.00", standard.GetProperty("freeOver").GetProperty("amount").GetString());
        Assert.Equal(2, standard.GetProperty("leadTimeDays").GetInt32());
    }

    [Fact]
    public async Task G5_DeliveryPromise_WithNoZoneAtTheStorefrontBranch_ReturnsNulls()
    {
        var scoped = Factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Shop:StorefrontBranchId"] = Guid.NewGuid().ToString() })));

        var promise = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await CreateClientOn(scoped).GetAsync("/api/shop/delivery-promise")));

        Assert.Equal(JsonValueKind.Null, promise.GetProperty("currencyCode").ValueKind);
        Assert.Equal(JsonValueKind.Null, promise.GetProperty("freeOver").ValueKind);
        Assert.Equal(JsonValueKind.Null, promise.GetProperty("leadTimeDays").ValueKind);
    }
}
