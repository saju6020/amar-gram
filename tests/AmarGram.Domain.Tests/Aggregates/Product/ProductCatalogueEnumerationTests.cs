using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>HO-P2 §1.1 to §1.3 -- the general catalogue: food is a rule on each category, subcategories belong to
/// exactly one category, and food products carry certifications.</summary>
public sealed class ProductCatalogueEnumerationTests
{
    private static ProductAggregate CreateProduct(ProductCategory category)
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Test Product", "Acme", category, null,
            Guid.NewGuid(), "test-product", null, null, TestUserContext.Create(), Guid.NewGuid()));
        return product;
    }

    [Fact]
    public void ProductCategory_HasElevenValues_AndOnlyHouseholdAndCareIsNotFood()
    {
        var all = Enumeration.GetAll<ProductCategory>().ToList();

        Assert.Equal(11, all.Count);
        Assert.Equal([ProductCategory.HouseholdAndCare], all.Where(c => !c.IsFood));
        Assert.Equal(10, ProductCategory.FoodValues.Count);
        Assert.DoesNotContain(ProductCategory.HouseholdAndCare.Value, ProductCategory.FoodValues);
    }

    [Fact]
    public void ProductSubcategory_EveryCategoryHasTwoToFourSubcategories()
    {
        var byCategory = Enumeration.GetAll<ProductSubcategory>().GroupBy(s => s.Category).ToDictionary(g => g.Key, g => g.Count());

        foreach (var category in Enumeration.GetAll<ProductCategory>())
            Assert.InRange(byCategory.GetValueOrDefault(category), 2, 4);
    }

    [Fact]
    public void Certification_HasTheFourHandoverValues()
    {
        Assert.Equal(["CertifiedOrganic", "PesticideFree", "Traditional", "Halal"],
            Enumeration.GetAll<Certification>().Select(c => c.DisplayName));
    }

    [Fact]
    public void ProductReturnClass_Of_FollowsTheCategoryRule()
    {
        Assert.Equal(ProductReturnClass.Food, ProductReturnClass.Of(ProductCategory.Spices));
        Assert.Equal(ProductReturnClass.Food, ProductReturnClass.Of(ProductCategory.FreshProduce));
        Assert.Equal(ProductReturnClass.Household, ProductReturnClass.Of(ProductCategory.HouseholdAndCare));
    }

    [Fact]
    public void UpdateDetails_CertificationsOnNonFoodProduct_AreDropped()
    {
        var product = CreateProduct(ProductCategory.HouseholdAndCare);

        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, product.Description, product.Category, product.Subcategory,
            product.Tags, product.TaxClassId, null, true, false, [Certification.Halal], TestUserContext.Create(), Guid.NewGuid()));

        Assert.Empty(product.Certifications);
    }

    [Fact]
    public void UpdateDetails_DuplicateCertifications_AreStoredOnce()
    {
        var product = CreateProduct(ProductCategory.Spices);

        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, product.Description, product.Category, product.Subcategory,
            product.Tags, product.TaxClassId, "BD", true, false, [Certification.Halal, Certification.Halal, Certification.Traditional],
            TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal([Certification.Halal, Certification.Traditional], product.Certifications);
    }

    [Fact]
    public void Publish_CertifiedOrganicWithoutCertificate_IsBlocked_AndWithItIsPublishable()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, product.Description, product.Category, product.Subcategory,
            product.Tags, product.TaxClassId, "BD", true, false, [Certification.CertifiedOrganic], TestUserContext.Create(), Guid.NewGuid()));
        var facts = new PublicationFacts([product.Skus.Single().Id], true, []);

        var blocked = ProductPublicationRules.Evaluate(product, facts).Single(i => i.Item == ProductPublicationRules.OrganicCertificate);
        Assert.True(blocked.IsBlocking);
        Assert.False(blocked.IsMet);

        product.SetFoodDetails(new FoodDetails(null, null, null, null, null, "Bangladesh Organic Board", "BOB-1042"), TestUserContext.Create(), Guid.NewGuid());

        Assert.True(ProductPublicationRules.Evaluate(product, facts).Single(i => i.Item == ProductPublicationRules.OrganicCertificate).IsMet);
        product.Publish(facts, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(ProductStatus.Active, product.Status);
    }

    [Fact]
    public void Publish_WithoutCertifiedOrganic_HasNoOrganicCertificateChecklistItem()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());

        var checklist = ProductPublicationRules.Evaluate(product, new PublicationFacts([product.Skus.Single().Id], true, []));

        Assert.DoesNotContain(checklist, i => i.Item == ProductPublicationRules.OrganicCertificate);
    }
}
