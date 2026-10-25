using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Order;
using AmarGram.Application.Commands.Product;
using AmarGram.Application.DataMappers;
using AmarGram.Infrastructure.Persistence.Views;
using AmarGram.Read.QueryHandlers.Product;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Product;

/// <summary>HO-P3 G1 (district), G4 (rider note) and G8 (certifications on list items) below the HTTP edge.</summary>
public sealed class StoreFrontGapsApplicationTests
{
    private static UserContext Ctx() => new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["ShopManager"] };

    private static UpdateProductDetailsCommand DetailsCommand(string? district) => new()
    {
        ProductId = Guid.NewGuid(), ExpectedVersion = 1, Name = "Rice", Brand = "Birganj Farms", Category = "RiceAndGrains", TaxClassId = Guid.NewGuid(),
        CountryOfOriginCode = "BD", DistrictOfOrigin = district, UserContext = Ctx(), CorrelationId = Guid.NewGuid()
    };

    private static PlaceOrderCommand PlaceCommand(string? riderNote) => new()
    {
        OrderId = Guid.NewGuid(), IdempotencyKey = Guid.NewGuid(), FulfilmentMethod = FulfilmentMethod.Delivery, PaymentMethod = OrderPaymentMethod.CashOnDelivery,
        QuoteFingerprint = new string('a', 64), RiderNote = riderNote, UserContext = Ctx(), CorrelationId = Guid.NewGuid()
    };

    // -- G1 ------------------------------------------------------------------------------------

    [Fact]
    public void UpdateDetailsValidator_District_IsOptional_AndBoundedByTheRule()
    {
        var validator = new UpdateProductDetailsCommandValidator();

        Assert.True(validator.Validate(DetailsCommand(null)).IsValid);
        Assert.True(validator.Validate(DetailsCommand("Dinajpur")).IsValid);
        Assert.True(validator.Validate(DetailsCommand(new string('a', ProductRules.DistrictMaxLength))).IsValid);
        Assert.False(validator.Validate(DetailsCommand(new string('a', ProductRules.DistrictMaxLength + 1))).IsValid);
        Assert.False(validator.Validate(DetailsCommand("Dina\u0007jpur")).IsValid);
    }

    [Fact]
    public void ProductMapper_CarriesTheDistrictToTheDomainDto()
    {
        var dto = DetailsCommand("Dinajpur").ToDomainDto(ProductCategory.RiceAndGrains, null, []);

        Assert.Equal("Dinajpur", dto.DistrictOfOrigin);
    }

    private static StorefrontCatalogueEntry Entry(string? district, int[] certifications) => new()
    {
        ProductId = Guid.NewGuid(), Slug = "s", Name = "N", Brand = "B", Category = ProductCategory.RiceAndGrains.Value, Kind = ProductKind.Standard.Value,
        SearchText = "n b", DistrictOfOrigin = district, Certifications = certifications
    };

    [Fact]
    public void CatalogueItem_CarriesTheDistrict()
    {
        Assert.Equal("Dinajpur", GetCatalogueQueryHandler.ToCatalogueItem(Entry("Dinajpur", []), inStock: true).DistrictOfOrigin);
        Assert.Null(GetCatalogueQueryHandler.ToCatalogueItem(Entry(null, []), inStock: true).DistrictOfOrigin);
    }

    // -- G8 ------------------------------------------------------------------------------------

    [Fact]
    public void CatalogueItem_CarriesCertificationNames_AsTheDetailDoes()
    {
        var item = GetCatalogueQueryHandler.ToCatalogueItem(Entry(null, [Certification.CertifiedOrganic.Value, Certification.Halal.Value]), inStock: true);

        Assert.Equal(["CertifiedOrganic", "Halal"], item.Certifications);
    }

    [Fact]
    public void CatalogueItem_WithNoCertifications_HasAnEmptyList_NotNull()
    {
        var item = GetCatalogueQueryHandler.ToCatalogueItem(Entry(null, []), inStock: true);

        Assert.NotNull(item.Certifications);
        Assert.Empty(item.Certifications!);
    }

    // -- G4 ------------------------------------------------------------------------------------

    [Fact]
    public void PlaceOrderValidator_RiderNote_IsOptional_AndBoundedByTheRule()
    {
        var validator = new PlaceOrderCommandValidator();

        Assert.True(validator.Validate(PlaceCommand(null)).IsValid);
        Assert.True(validator.Validate(PlaceCommand("Please call at the gate.")).IsValid);
        Assert.True(validator.Validate(PlaceCommand(new string('n', OrderRules.MaxRiderNoteLength))).IsValid);
        Assert.False(validator.Validate(PlaceCommand(new string('n', OrderRules.MaxRiderNoteLength + 1))).IsValid);
        Assert.False(validator.Validate(PlaceCommand("bell\u0000")).IsValid);
    }
}
