using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Entities;

namespace AmarGram.Domain.Tests.DomainServices;

/// <summary>HO-SHP-001 §15 Phase H -- U-H6 (content resolution). HO-P1 retired the food-recommendation cases (U-H1 to U-H5).</summary>
public sealed class ProductContentLocalisationTests
{
    private static readonly string[] Enabled = ["en", "bn"];

    [Fact]
    public void U_H6_PerFieldFallback_NameInBn_DescriptionFallsBackToEn()
    {
        var translations = new List<ProductTranslation> { new("bn", "অর্গানিক চাল", "", "মুরগি", null) };

        var resolved = ProductContentLocalisation.Resolve("Organic Rice", "A description", "chicken", "Feed twice a day", translations, "bn", "en", Enabled);

        Assert.Equal("অর্গানিক চাল", resolved.Name);
        Assert.Equal("A description", resolved.Description);
        Assert.Equal("মুরগি", resolved.IngredientList);
        Assert.Equal("Feed twice a day", resolved.FeedingGuide);
        Assert.Equal("bn", resolved.Locale);
        Assert.Equal("bn", resolved.FieldLocales["name"]);
        Assert.Equal("en", resolved.FieldLocales["description"]);
        Assert.Equal("bn", resolved.FieldLocales["ingredientList"]);
        Assert.Equal("en", resolved.FieldLocales["feedingGuide"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("en")]
    [InlineData("fr")]
    [InlineData("xx-YY")]
    public void U_H6_DefaultOrUnknownOrDisabledLocale_ResolvesToTheDefault_NeverAnError(string? requested)
    {
        var translations = new List<ProductTranslation> { new("bn", "চাল", "বর্ণনা", "মুরগি", "দিনে দুইবার") };

        var resolved = ProductContentLocalisation.Resolve("Organic Rice", "A description", "chicken", "Feed", translations, requested, "en", Enabled);

        Assert.Equal("Organic Rice", resolved.Name);
        Assert.Equal("en", resolved.Locale);
        Assert.All(resolved.FieldLocales.Values, v => Assert.Equal("en", v));
    }

    [Fact]
    public void U_H6_ALocaleNoLongerEnabled_IsIgnored_EvenWithAStoredTranslation()
    {
        var translations = new List<ProductTranslation> { new("bn", "চাল", null, null, null) };

        var resolved = ProductContentLocalisation.Resolve("Organic Rice", "d", null, null, translations, "bn", "en", ["en"]);

        Assert.Equal("Organic Rice", resolved.Name);
    }
}
