using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Aggregates.StoredFile;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>
/// HO-SHP-001 section 16 cases that had no implementing test at the TEST gate (2026-10-04):
/// U-A5b (a gif is never a product image), U-B2 (the organic certificate rules, formerly guaranteed-analysis validation) and the domain
/// half of R3 (the four violation codes that replaced the wrong <c>InvalidSlug</c>). The HTTP
/// halves live in <c>ShopSection16GapEndpointTests</c>. Section 18: A1 (U-A5b), A6 (U-B2).
/// </summary>
public sealed class ProductSection16GapTests
{
    private static readonly Guid TaxClassId = Guid.NewGuid();

    private static ProductAggregate CreateProduct(ProductCategory? category = null)
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(
            ProductKind.Standard, "Test Product", "Acme", category ?? ProductCategory.HouseholdAndCare, null,
            TaxClassId, "test-product", null, null, TestUserContext.Create(), Guid.NewGuid()));
        return product;
    }

    private static ProductDetailsUpdateDto DetailsDto(ProductAggregate product, string? name = null, string? brand = null, string? description = null) =>
        new(name ?? product.Name, brand ?? product.Brand, description ?? product.Description, product.Category, product.Subcategory, product.Tags,
            product.TaxClassId, null, product.ListedOnStorefront, false, [], TestUserContext.Create(), Guid.NewGuid());

    // ── U-A5b ───────────────────────────────────────────────────────────────────────────────────
    // The Product aggregate stores a product image's FileId only (section 1 Amended, Phase A (2));
    // the content type is the StoredFile's rule, which every product image must pass before the
    // handler lets its FileId anywhere near SetImages (SetProductImagesCommandHandler).

    private static StoredFileRegistrationDto FileDto(string contentType, FilePurpose purpose) => new(
        Guid.NewGuid(), purpose, contentType, 1024, new string('a', 64), "product.file",
        "ProductImage/2026/10/" + Guid.NewGuid().ToString("N"), Guid.NewGuid(), DateTimeOffset.UtcNow,
        "DevelopmentNoOp", null, TestUserContext.Create(), Guid.NewGuid());

    [Fact]
    public void U_A5b_ProductImageFile_WithGifContentType_IsRefused()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            new StoredFileAggregate(Guid.NewGuid()).Register(FileDto("image/gif", FilePurpose.ProductImage)));

        Assert.Equal(BusinessViolationCodes.FileTypeNotAllowed, ex.ErrorCode);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    public void U_A5b_ProductImageFile_WithTheThreeAllowedTypes_IsAccepted(string contentType)
    {
        var file = new StoredFileAggregate(Guid.NewGuid());

        file.Register(FileDto(contentType, FilePurpose.ProductImage));

        Assert.Equal(contentType, file.ContentType);
    }

    [Fact]
    public void U_A5b_NoProductImageRuleAllowsGif()
    {
        var rule = FileRules.Find(FilePurpose.ProductImage)!;

        Assert.DoesNotContain(rule.AllowedContentTypes, t => t.Equals("image/gif", StringComparison.OrdinalIgnoreCase));
    }

    // ── U-B2 (HO-P2 §1.3: the guaranteed-analysis block became the organic certificate rules) ─────

    [Fact]
    public void U_B2_FoodLabel_IsStoredOnTheProduct()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);

        product.SetFoodDetails(new FoodDetails("Rice", "Cool and dry", "12 months", "5 kg", "None", "Bangladesh Organic Board", "BOB-1042"),
            TestUserContext.Create(), Guid.NewGuid());

        var food = product.FoodDetails!;
        Assert.Equal(("Rice", "Cool and dry", "12 months", "5 kg", "None"), (food.IngredientList, food.StorageInstructions, food.ShelfLife, food.NetWeight, food.Allergens));
        Assert.True(food.HasOrganicCertificate);
        Assert.True(food.HasFullLabelling);
    }

    [Theory]
    [InlineData("Bangladesh Organic Board", null)]
    [InlineData(null, "BOB-1042")]
    [InlineData(null, null)]
    public void U_B2_OrganicCertificate_NeedsBothFields(string? certifier, string? number)
    {
        var food = new FoodDetails(null, null, null, null, null, certifier, number);

        Assert.False(food.HasOrganicCertificate);
    }

    [Fact]
    public void U_B2_OverlongFoodField_IsRejected()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            new FoodDetails(null, null, new string('x', ProductRules.ShelfLifeMaxLength + 1), null, null, null, null));

        Assert.Equal(BusinessViolationCodes.FoodDetailsOnlyForFood, ex.ErrorCode);
    }

    [Fact]
    public void U_B2_ActiveCertifiedOrganicProduct_CannotLoseItsCertificate()
    {
        var product = CreateProduct(ProductCategory.RiceAndGrains);
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.SetFoodDetails(new FoodDetails(null, null, null, null, null, "Bangladesh Organic Board", "BOB-1042"), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, product.Description, product.Category, product.Subcategory,
            product.Tags, product.TaxClassId, "BD", product.ListedOnStorefront, true, [Certification.CertifiedOrganic],
            TestUserContext.Create(), Guid.NewGuid()));
        product.Publish(new PublicationFacts([product.Skus.Single().Id], true, []), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            product.SetFoodDetails(new FoodDetails(null, null, null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.OrganicCertificateRequired, ex.ErrorCode);
    }

    // ── R3 (domain) ─────────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void R3_Create_BlankName_IsInvalidProductName(string name)
    {
        var product = new ProductAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.Create(new ProductCreateDto(
            ProductKind.Standard, name, "Acme", ProductCategory.HouseholdAndCare, null, TaxClassId, "slug-a", null, null, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.InvalidProductName, ex.ErrorCode);
    }

    [Fact]
    public void R3_UpdateDetails_NameOverTwoHundred_IsInvalidProductName()
    {
        var product = CreateProduct();

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.UpdateDetails(DetailsDto(product, name: new string('n', ProductRules.NameMaxLength + 1))));

        Assert.Equal(BusinessViolationCodes.InvalidProductName, ex.ErrorCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void R3_Create_BlankBrand_IsInvalidBrand(string brand)
    {
        var product = new ProductAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.Create(new ProductCreateDto(
            ProductKind.Standard, "Name", brand, ProductCategory.HouseholdAndCare, null, TaxClassId, "slug-b", null, null, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.InvalidBrand, ex.ErrorCode);
    }

    [Fact]
    public void R3_UpdateDetails_BrandOverOneHundred_IsInvalidBrand()
    {
        var product = CreateProduct();

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.UpdateDetails(DetailsDto(product, brand: new string('b', ProductRules.BrandMaxLength + 1))));

        Assert.Equal(BusinessViolationCodes.InvalidBrand, ex.ErrorCode);
    }

    [Fact]
    public void R3_UpdateDetails_DescriptionOverLimit_IsInvalidProductDescription()
    {
        var product = CreateProduct();

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.UpdateDetails(DetailsDto(product, description: new string('d', ProductRules.DescriptionMaxLength + 1))));

        Assert.Equal(BusinessViolationCodes.InvalidProductDescription, ex.ErrorCode);
    }

    [Fact]
    public void R3_UpdateDetails_DescriptionAtTheLimit_IsAccepted()
    {
        var product = CreateProduct();

        product.UpdateDetails(DetailsDto(product, description: new string('d', ProductRules.DescriptionMaxLength)));

        Assert.Equal(ProductRules.DescriptionMaxLength, product.Description.Length);
    }

    [Theory]
    [InlineData("rc-1")]          // lower case
    [InlineData("RC--1")]         // double hyphen
    [InlineData("-RC1")]          // leading hyphen
    [InlineData("RC 1")]          // space
    [InlineData("RC_1")]          // underscore
    [InlineData("")]              // empty
    public void R3_AddSku_MalformedCode_IsInvalidSkuCode(string code)
    {
        var product = CreateProduct();

        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            product.AddSku(new SkuAddDto(Guid.NewGuid(), code, null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.InvalidSkuCode, ex.ErrorCode);
    }

    [Fact]
    public void R3_AddSku_CodeOverFortyCharacters_IsInvalidSkuCode()
    {
        var product = CreateProduct();

        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            product.AddSku(new SkuAddDto(Guid.NewGuid(), new string('A', ProductRules.SkuCodeMaxLength + 1), null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.InvalidSkuCode, ex.ErrorCode);
    }

    [Fact]
    public void R3_NoneOfTheFourCodes_IsTheOldInvalidSlug()
    {
        Assert.NotEqual(BusinessViolationCodes.InvalidSlug, BusinessViolationCodes.InvalidProductName);
        Assert.NotEqual(BusinessViolationCodes.InvalidSlug, BusinessViolationCodes.InvalidBrand);
        Assert.NotEqual(BusinessViolationCodes.InvalidSlug, BusinessViolationCodes.InvalidProductDescription);
        Assert.NotEqual(BusinessViolationCodes.InvalidSlug, BusinessViolationCodes.InvalidSkuCode);
    }
}
