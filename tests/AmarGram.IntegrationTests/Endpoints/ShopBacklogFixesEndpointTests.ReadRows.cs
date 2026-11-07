using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Product;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>Rows 15, 19, 30, 41 -- projection edge cases, eligibility visibility, filter validation, price-filter clock.</summary>
public sealed partial class ShopBacklogFixesEndpointTests
{
    // ── Row 15: a product with no SKUs, and the food block's presence check ─────────────────────

    [Fact]
    public async Task Row15_ALiveProductWithNoSkus_IsNotA404ForReviewEligibility()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand("NoSku"), "Skuless Bag");
        // HO-XCT-001 ADR-299: a SKU row is retained (Forbidden), so "no SKUs" is made by moving the SKU to a second product.
        var holder = await CreateProductAsync(staff, NewBrand("NoSkuHolder"), "Sku Holder");
        await ExecuteSqlAsync($"UPDATE product.sku SET product_id = {holder.ProductId} WHERE product_id = {product.ProductId}");
        var (customer, _) = await RegisterAndSignInCustomerAsync();

        var eligibility = await customer.GetAsync($"/api/customers/me/shop/products/{product.Slug}/review-eligibility");
        Assert.Equal(HttpStatusCode.OK, eligibility.StatusCode);
        Assert.False((await JsonOkAsync(eligibility)).GetProperty("canReview").GetBoolean());
    }

    [Fact]
    public async Task Row15_FoodBlock_AppearsWhenOnlyTheNetWeightColumnIsSet()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand("NetWeightOnly"), "Net Weight Only Food", "RiceAndGrains");
        // Every other food column cleared: only the net weight remains (a state a first-column-only check would miss).
        await ExecuteSqlAsync($@"UPDATE product.product SET food_ingredient_list = NULL, food_storage_instructions = NULL,
            food_shelf_life = NULL, food_allergens = NULL, food_organic_certifier = NULL, food_organic_certificate_number = NULL,
            food_net_weight = '5 kg' WHERE ""Id"" = {product.ProductId}");

        var detail = await JsonOkAsync(await CreateClient().GetAsync($"/api/shop/products/{product.Slug}"));

        Assert.Equal(JsonValueKind.Object, detail.GetProperty("food").ValueKind);
    }

    // ── Row 19: review eligibility does not reveal unreleased products ──────────────────────────

    [Fact]
    public async Task Row19_ReviewEligibility_ForADraftOrUnlistedSlug_IsA404_LikeAnUnknownOne()
    {
        var staff = await SignInAsShopManagerAsync();
        var draft = await CreateProductAsync(staff, NewBrand("EligDraft"), "Draft Eligibility", publish: false);
        var unlisted = await CreateProductAsync(staff, NewBrand("EligHidden"), "Unlisted Eligibility");
        await UnlistAsync(staff, unlisted.ProductId);
        var live = await CreateProductAsync(staff, NewBrand("EligLive"), "Live Eligibility");
        var (customer, _) = await RegisterAndSignInCustomerAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync($"/api/customers/me/shop/products/{draft.Slug}/review-eligibility")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync($"/api/customers/me/shop/products/{unlisted.Slug}/review-eligibility")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync($"/api/customers/me/shop/products/{UniqueSlug("nope")}/review-eligibility")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await customer.GetAsync($"/api/customers/me/shop/products/{live.Slug}/review-eligibility")).StatusCode);
    }

    // ── Row 30: unknown filter values are refused consistently ──────────────────────────────────

    [Theory]
    [InlineData("category=NotACategory", "category")]
    [InlineData("subcategory=NotASubcategory", "subcategory")]
    [InlineData("origin=ZZ9", "origin")]
    [InlineData("certification=Unicorn", "certification")]
    public async Task Row30_UnknownEnumeratedFilter_IsInvalidCatalogueFilter_NamingTheParameter(string filter, string parameter)
    {
        var response = await CreateClient().GetAsync($"/api/shop/products?{filter}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains(BusinessViolationCodes.InvalidCatalogueFilter, body);
        Assert.Contains(parameter, body);
    }

    [Fact]
    public async Task Row30_KnownFilterValues_StillWork()
    {
        var response = await CreateClient().GetAsync("/api/shop/products?category=RiceAndGrains&origin=DE");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── Row 41: the price filter and the view share the database clock ──────────────────────────

    [Fact]
    public async Task Row41_PriceFilter_UsesTheDatabaseClock_NotTheApplicationClock()
    {
        var staff = await SignInAsShopManagerAsync();
        var brand = NewBrand("DbClock");
        var product = await CreateProductAsync(staff, brand, "Db Clock Product", price: 4321m);

        // An application clock a day BEHIND the database's: under it the price (effective "now" by the real
        // clock) has not started yet, so an application-clock filter drops the product that the view displays.
        var behind = new Microsoft.Extensions.Time.Testing.FakeTimeProvider(DateTimeOffset.UtcNow.AddDays(-1));
        var clockFactory = Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(behind)));

        var response = await clockFactory.CreateClient().GetAsync($"/api/shop/products?brand={Uri.EscapeDataString(brand)}&minPrice=4000&maxPrice=5000");
        var body = await JsonOkAsync(response);

        var item = Assert.Single(body.GetProperty("items").EnumerateArray());
        Assert.Equal(product.ProductId, item.GetProperty("productId").GetGuid());
        Assert.Equal("4321.00", item.GetProperty("fromPrice").GetProperty("amount").GetString());
    }
}
