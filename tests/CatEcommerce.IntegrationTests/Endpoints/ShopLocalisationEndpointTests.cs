using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CatEcommerce.Application.Commands.Product;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Xunit;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>
/// HO-SHP-001 §16 Phase H -- I-H4..I-H6 (US-SHP-14): product content localisation.
/// </summary>
public sealed class ShopLocalisationEndpointTests(ShopApiFactory factory) : ShopIntegrationTestBase(factory)
{
    private static string NewBrand(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..20];

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    // ── I-H4 / I-H5 / I-H6 ──────────────────────────────────────────────────────────────────────

    private async Task<(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> BnFactory, HttpClient Staff, SeededProduct Product)> BengaliProductAsync()
    {
        var bnFactory = Factory.WithBengaliEnabled();
        var staff = await SignInAsShopManagerAsync(bnFactory);
        var product = await CreateProductAsync(staff, NewBrand("Bn"), "English Name", "CatFood", ingredientList: "english ingredients");
        return (bnFactory, staff, product);
    }

    private async Task SetTranslationAsync(HttpClient staff, Guid productId, string locale, object content, HttpStatusCode expected = HttpStatusCode.NoContent)
    {
        var json = JsonSerializer.SerializeToElement(content, Json);
        var body = new Dictionary<string, object?> { ["expectedVersion"] = await ProductVersionAsync(staff, productId) };
        foreach (var property in json.EnumerateObject()) body[property.Name] = property.Value;

        var response = await staff.PutAsJsonAsync($"/api/staff/shop/products/{productId}/translations/{locale}", body, Json);
        Assert.True(response.StatusCode == expected, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
    }

    [Fact]
    public async Task I_H4_AllFourFieldsInBengali_ShowInBengali_WithEveryFieldLocaleBn()
    {
        var (bnFactory, staff, product) = await BengaliProductAsync();

        await SetTranslationAsync(staff, product.ProductId, "bn", new
        { name = "বাংলা নাম", description = "বাংলা বিবরণ", ingredientList = "মুরগি, চাল", feedingGuide = "দিনে দুইবার" });

        var anonymous = bnFactory.CreateClient();
        var body = await JsonOkAsync(await anonymous.GetAsync($"/api/shop/products/{product.Slug}?locale=bn"));

        Assert.Equal("বাংলা নাম", body.GetProperty("name").GetString());
        Assert.Equal("বাংলা বিবরণ", body.GetProperty("description").GetString());
        Assert.Equal("মুরগি, চাল", body.GetProperty("food").GetProperty("ingredientList").GetString());
        Assert.Equal("দিনে দুইবার", body.GetProperty("food").GetProperty("feedingGuide").GetString());
        Assert.Equal("bn", body.GetProperty("locale").GetString());
        foreach (var field in new[] { "name", "description", "ingredientList", "feedingGuide" })
            Assert.Equal("bn", body.GetProperty("fieldLocales").GetProperty(field).GetString());

        // The default language is untouched.
        var english = await JsonOkAsync(await anonymous.GetAsync($"/api/shop/products/{product.Slug}"));
        Assert.Equal("English Name", english.GetProperty("name").GetString());
        Assert.Equal("en", english.GetProperty("locale").GetString());

        // US-SHP-14 AC3: the staff detail lists the stored translation.
        var detail = await staff.GetFromJsonAsync<JsonElement>($"/api/staff/shop/products/{product.ProductId}", Json);
        var stored = Assert.Single(detail.GetProperty("translations").EnumerateArray());
        Assert.Equal("bn", stored.GetProperty("locale").GetString());
        Assert.Equal("বাংলা নাম", stored.GetProperty("name").GetString());
    }

    [Fact]
    public async Task I_H4_TheCatalogueListAndSearch_UseTheTranslatedName()
    {
        var (bnFactory, staff, product) = await BengaliProductAsync();
        var token = "BnToken" + Guid.NewGuid().ToString("N")[..10];
        await SetTranslationAsync(staff, product.ProductId, "bn", new { name = $"{token} বাংলা" });

        var anonymous = bnFactory.CreateClient();

        // Search matches the translated name (it joins SearchText) in any locale.
        var byTranslatedName = await JsonOkAsync(await anonymous.GetAsync($"/api/shop/products?q={token.ToLowerInvariant()}&locale=bn"));
        var item = byTranslatedName.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("productId").GetGuid() == product.ProductId);
        Assert.Equal($"{token} বাংলা", item.GetProperty("name").GetString());

        // Without a locale the same product lists under its default-language name.
        var english = await JsonOkAsync(await anonymous.GetAsync($"/api/shop/products?q={token.ToLowerInvariant()}"));
        Assert.Equal("English Name", english.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("productId").GetGuid() == product.ProductId).GetProperty("name").GetString());
    }

    [Fact]
    public async Task I_H5_ARemovedBengaliFeedingGuide_FallsBackToEnglish_PerField()
    {
        var (bnFactory, staff, product) = await BengaliProductAsync();
        // The product's own (English) feeding guide.
        var food = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/food",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), ingredientList = "english ingredients", feedingGuide = "Feed twice a day" }, Json);
        Assert.Equal(HttpStatusCode.NoContent, food.StatusCode);

        await SetTranslationAsync(staff, product.ProductId, "bn", new { name = "বাংলা নাম", ingredientList = "মুরগি", feedingGuide = "দিনে দুইবার" });
        // Replace the translation without a feeding guide: that field now falls back.
        await SetTranslationAsync(staff, product.ProductId, "bn", new { name = "বাংলা নাম", ingredientList = "মুরগি" });

        var body = await JsonOkAsync(await bnFactory.CreateClient().GetAsync($"/api/shop/products/{product.Slug}?locale=bn"));

        Assert.Equal("Feed twice a day", body.GetProperty("food").GetProperty("feedingGuide").GetString());
        Assert.Equal("en", body.GetProperty("fieldLocales").GetProperty("feedingGuide").GetString());
        Assert.Equal("bn", body.GetProperty("fieldLocales").GetProperty("name").GetString());
        Assert.Equal("bn", body.GetProperty("fieldLocales").GetProperty("ingredientList").GetString());
        Assert.Equal("en", body.GetProperty("fieldLocales").GetProperty("description").GetString());

        // Removing the translation altogether: everything falls back.
        var remove = await staff.DeleteAsync($"/api/staff/shop/products/{product.ProductId}/translations/bn?expectedVersion={await ProductVersionAsync(staff, product.ProductId)}");
        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);
        var afterRemove = await JsonOkAsync(await bnFactory.CreateClient().GetAsync($"/api/shop/products/{product.Slug}?locale=bn"));
        Assert.Equal("English Name", afterRemove.GetProperty("name").GetString());
        Assert.All(afterRemove.GetProperty("fieldLocales").EnumerateObject(), p => Assert.Equal("en", p.Value.GetString()));
    }

    [Fact]
    public async Task I_H6_ALocaleThatIsNotEnabled_Is400_OnWrite_AndTheDefaultLanguageOnAPublicRead()
    {
        var staff = await SignInAsShopManagerAsync();
        var product = await CreateProductAsync(staff, NewBrand("NoFr"), "Plain Name", "CatFood");

        // The base factory keeps the shipped default: only English is enabled.
        var locales = await JsonOkAsync(await CreateClient().GetAsync("/api/shop/locales"));
        Assert.Equal("en", locales.GetProperty("defaultLocale").GetString());
        Assert.Equal(["en"], locales.GetProperty("locales").EnumerateArray().Select(l => l.GetString()));

        var put = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/translations/fr",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), name = "Nom" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
        Assert.Contains("LocaleNotEnabled", await put.Content.ReadAsStringAsync());

        var english = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/translations/en",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), name = "Name" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, english.StatusCode);
        Assert.Contains("DefaultLocaleNotTranslatable", await english.Content.ReadAsStringAsync());

        var malformed = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/translations/FRENCH",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), name = "Nom" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);

        // A public read with an unknown or disabled locale is the default language, never an error.
        foreach (var locale in new[] { "fr", "bn", "nonsense", "" })
        {
            var read = await JsonOkAsync(await CreateClient().GetAsync($"/api/shop/products/{product.Slug}?locale={locale}"));
            Assert.Equal("Plain Name", read.GetProperty("name").GetString());
            Assert.Equal("en", read.GetProperty("locale").GetString());
        }
    }

    [Fact]
    public async Task I_H6_Translations_StaleVersionIs409_AndOnlyManagersMayWrite()
    {
        var (bnFactory, staff, product) = await BengaliProductAsync();

        var stale = await staff.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/translations/bn", new { expectedVersion = 1, name = "x" }, Json);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var (_, mobile, password) = await SeedStaffAsync("Reception");
        var reception = await SignInStaffAsync(mobile, password, bnFactory);
        var forbidden = await reception.PutAsJsonAsync($"/api/staff/shop/products/{product.ProductId}/translations/bn",
            new { expectedVersion = await ProductVersionAsync(staff, product.ProductId), name = "x" }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }
}
