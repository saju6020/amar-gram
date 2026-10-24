using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>HO-SHP-001 §15 Phase B -- U-B1, U-B3, U-B4, U-B5, U-B6, U-B7, U-B8.</summary>
public sealed class ProductAggregateFoodTests
{
    private static readonly Guid TaxClassId = Guid.NewGuid();

    private static ProductAggregate CreateProduct(ProductCategory category, ProductSubcategory? subcategory = null, string slug = "product")
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Test Product", "Acme", category, subcategory,
            TaxClassId, slug, null, null, TestUserContext.Create(), Guid.NewGuid()));
        return product;
    }

    private static ProductDetailsUpdateDto DetailsDto(ProductAggregate product, string? countryCode, bool isExpiryTracked = false, IReadOnlyList<Certification>? certifications = null) =>
        new(product.Name, product.Brand, product.Description, product.Category, product.Subcategory, product.Tags,
            product.TaxClassId, countryCode, product.ListedOnStorefront, isExpiryTracked, certifications ?? [], TestUserContext.Create(), Guid.NewGuid());

    [Fact]
    public void SetFoodDetails_OnNonFoodProduct_ThrowsFoodDetailsOnlyForFood()
    {
        var product = CreateProduct(ProductCategory.HouseholdAndCare, ProductSubcategory.JuteAndBags);
        var details = new FoodDetails(null, null, null, null, null, null, null);

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.SetFoodDetails(details, TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal(BusinessViolationCodes.FoodDetailsOnlyForFood, ex.ErrorCode);
    }

    [Fact]
    public void Publish_FoodProductMissingCountryOfOrigin_MessageMentionsCountryOfOrigin()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.SetFoodDetails(new FoodDetails("Basmati rice", null, null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());

        var facts = new PublicationFacts([product.Skus.Single().Id], true, []);
        var ex = Assert.Throws<DomainRuleViolationException>(() => product.Publish(facts, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));

        Assert.Contains("country of origin", ex.Message.ToLowerInvariant());

        // Add it -> now publishable (assuming a priced SKU is present).
        product.UpdateDetails(DetailsDto(product, "DE"));
        product.Publish(facts, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(AmarGram.Shared.Common.Enums.ProductStatus.Active, product.Status);
    }

    [Fact]
    public void UpdateDetails_ClearCountryOfOriginOnActiveFoodProduct_Throws()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.SetFoodDetails(new FoodDetails(null, null, null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(DetailsDto(product, "DE"));
        var facts = new PublicationFacts([product.Skus.Single().Id], true, []);
        product.Publish(facts, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.UpdateDetails(DetailsDto(product, null)));
        Assert.Equal(BusinessViolationCodes.CountryOfOriginRequired, ex.ErrorCode);
    }

    [Theory]
    [InlineData("DE", "DE")]
    [InlineData("de", "DE")]
    public void UpdateDetails_CountryCodeNormalised(string input, string expected)
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.UpdateDetails(DetailsDto(product, input));
        Assert.Equal(expected, product.CountryOfOriginCode);
    }

    [Fact]
    public void UpdateDetails_UnknownCountryCode_ThrowsInvalidCountryCode()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        var ex = Assert.Throws<DomainRuleViolationException>(() => product.UpdateDetails(DetailsDto(product, "XX")));
        Assert.Equal(BusinessViolationCodes.InvalidCountryCode, ex.ErrorCode);
    }

    [Fact]
    public void UpdateDetails_FoodProductWithExpiryTrackingFalseRequested_StoresTrue()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.UpdateDetails(DetailsDto(product, "DE", isExpiryTracked: false));
        Assert.True(product.IsExpiryTracked);
    }

    [Fact]
    public void PublicationChecklist_FoodMissingIngredientsAndShelfLife_LabellingWarningOnly_StillPublishable()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.SetFoodDetails(new FoodDetails(null, "Keep cool and dry", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(DetailsDto(product, "DE"));

        var facts = new PublicationFacts([product.Skus.Single().Id], true, []);
        var checklist = AmarGram.Domain.DomainServices.ProductPublicationRules.Evaluate(product, facts);

        var labelling = checklist.Single(i => i.Item == AmarGram.Domain.DomainServices.ProductPublicationRules.LabellingComplete);
        Assert.False(labelling.IsBlocking);
        Assert.False(labelling.IsMet);

        // Publish should still succeed since LabellingComplete is warning-only.
        product.Publish(facts, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(AmarGram.Shared.Common.Enums.ProductStatus.Active, product.Status);
    }
}
