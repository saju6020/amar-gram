using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-SHP-001 CODE_REVIEW gate fixes (2026-10-04): the price filter is section 12.4 rule (ANY
/// active SKU CURRENT price within the bounds; no current price never matches a bound).
/// </summary>
public sealed class ShopCodeReviewFixesEndpointTests(ShopApiFactory factory) : ShopIntegrationTestBase(factory)
{
    private static string NewBrand(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..20];

    [Fact]
    public async Task PriceFilter_MatchesAnySkuCurrentPriceInRange_NotARangeOverlap_AndNoCurrentPriceNeverMatches()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = NewBrand("PriceBand");
        var taxClassId = await SeedActiveTaxClassAsync(UniqueCode("TAX"));

        async Task<Guid> TwoSkuProductAsync(string name, decimal first, decimal second)
        {
            var create = await staff.PostAsJsonAsync("/api/staff/shop/products", new { kind = "Standard", name, brand, category = "ToysAndFurniture", taxClassId, slug = UniqueSlug("band") }, Json);
            var productId = (await create.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("productId").GetGuid();
            foreach (var (size, price) in new[] { ("S", first), ("L", second) })
            {
                var sku = await staff.PostAsJsonAsync($"/api/staff/shop/products/{productId}/skus",
                    new { expectedVersion = await ProductVersionAsync(staff, productId), code = UniqueCode("BAND"), sizeOrWeight = size }, Json);
                var skuId = (await sku.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("skuId").GetGuid();
                await SchedulePriceAsync(staff, skuId, price);
            }

            await PublishAsync(staff, productId);
            return productId;
        }

        var spread = await TwoSkuProductAsync("Spread 500 and 5000", 500m, 5000m);   // overlaps 1000-1500, no SKU inside it
        var inside = await TwoSkuProductAsync("Spread 500 and 1200", 500m, 1200m);   // one SKU at 1200
        var unpriced = await CreateProductAsync(staff, brand, "Unpriced Now", price: 1200m);
        await MakeSkuUnpricedAsync(unpriced.SkuId); // moves its only price into the future: no current price

        var anonymous = CreateClient();
        async Task<List<Guid>> SearchAsync(string query)
        {
            var body = await JsonOkAsync(await anonymous.GetAsync($"/api/shop/products?brand={Uri.EscapeDataString(brand)}&{query}"));
            return body.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("productId").GetGuid()).ToList();
        }

        var band = await SearchAsync("minPrice=1000&maxPrice=1500");
        Assert.Contains(inside, band);
        Assert.DoesNotContain(spread, band);
        Assert.DoesNotContain(unpriced.ProductId, band);

        Assert.Contains(spread, await SearchAsync("minPrice=4500"));      // the 5000 SKU
        Assert.DoesNotContain(inside, await SearchAsync("minPrice=4500"));
        Assert.Contains(spread, await SearchAsync("maxPrice=600"));       // the 500 SKU
        Assert.DoesNotContain(unpriced.ProductId, await SearchAsync("maxPrice=100000"));

        // With no bound the unpriced product is still listed (the price filter is the only thing excluding it).
        Assert.Contains(unpriced.ProductId, await SearchAsync("q=unpriced"));
    }

    [Fact]
    public async Task PriceFilter_ParsesInvariantCulture_AndRejectsGarbage()
    {
        var client = CreateClient();
        var body = await JsonOkAsync(await client.GetAsync("/api/shop/products?minPrice=10.5&maxPrice=20.25"));
        Assert.Equal("10.50", body.GetProperty("appliedFilters").GetProperty("minPrice").GetString());
        Assert.Equal("20.25", body.GetProperty("appliedFilters").GetProperty("maxPrice").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/shop/products?minPrice=ten")).StatusCode);
    }
}
