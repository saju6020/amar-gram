using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>HO-P3 G1 -- the optional district of origin, alongside the country.</summary>
public sealed class ProductDistrictOfOriginTests
{
    private static ProductAggregate CreateProduct()
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Aromatic Rice", "Birganj Farms", ProductCategory.RiceAndGrains, null,
            Guid.NewGuid(), "aromatic-rice", null, null, TestUserContext.Create(), Guid.NewGuid()));
        return product;
    }

    private static void Update(ProductAggregate product, string? district) =>
        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, product.Description, product.Category, product.Subcategory,
            product.Tags, product.TaxClassId, "BD", true, false, [], TestUserContext.Create(), Guid.NewGuid(), district));

    [Fact]
    public void NewProduct_HasNoDistrict()
    {
        Assert.Null(CreateProduct().DistrictOfOrigin);
    }

    [Fact]
    public void UpdateDetails_SetsTheDistrict_Trimmed()
    {
        var product = CreateProduct();

        Update(product, "  Dinajpur ");

        Assert.Equal("Dinajpur", product.DistrictOfOrigin);
        Assert.Equal("BD", product.CountryOfOriginCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateDetails_BlankDistrict_ClearsIt(string? blank)
    {
        var product = CreateProduct();
        Update(product, "Dinajpur");

        Update(product, blank);

        Assert.Null(product.DistrictOfOrigin);
    }

    [Fact]
    public void UpdateDetails_DistrictAtTheMaximum_IsAccepted()
    {
        var product = CreateProduct();

        Update(product, new string('a', ProductRules.DistrictMaxLength));

        Assert.Equal(ProductRules.DistrictMaxLength, product.DistrictOfOrigin!.Length);
    }

    [Fact]
    public void UpdateDetails_DistrictOverTheMaximum_Throws_AndKeepsTheOldValue()
    {
        var product = CreateProduct();
        Update(product, "Dinajpur");

        var ex = Assert.Throws<DomainRuleViolationException>(() => Update(product, new string('a', ProductRules.DistrictMaxLength + 1)));

        Assert.Equal(BusinessViolationCodes.InvalidDistrictOfOrigin, ex.ErrorCode);
        Assert.Equal("Dinajpur", product.DistrictOfOrigin);
    }

    [Fact]
    public void UpdateDetails_DistrictWithControlCharacters_Throws()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Update(CreateProduct(), "Dina\tjpur"));

        Assert.Equal(BusinessViolationCodes.InvalidDistrictOfOrigin, ex.ErrorCode);
    }
}
