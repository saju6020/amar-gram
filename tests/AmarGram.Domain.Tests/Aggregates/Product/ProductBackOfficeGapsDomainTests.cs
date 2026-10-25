using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>HO-P4 BG-13 (compare-at price) and BG-14 (organic certificate expiry and file).</summary>
public sealed class ProductBackOfficeGapsDomainTests
{
    private static readonly DateOnly Today = new(2026, 10, 25);

    // ── BG-13 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static SkuPriceCreateDto PriceDto(decimal amount, decimal? compareAt, string currency = "BDT")
    {
        var now = DateTimeOffset.UtcNow;
        return new SkuPriceCreateDto(Guid.NewGuid(), new Money(amount, currency), now, Guid.NewGuid(), now, TestUserContext.Create(), Guid.NewGuid(), compareAt);
    }

    [Fact]
    public void Price_WithCompareAtAbovePrice_KeepsIt()
    {
        var price = new SkuPriceAggregate(Guid.NewGuid());
        price.Create(PriceDto(100m, 120m), "BDT");
        Assert.Equal(120m, price.CompareAtAmount);
    }

    [Fact]
    public void Price_WithoutCompareAt_HasNone()
    {
        var price = new SkuPriceAggregate(Guid.NewGuid());
        price.Create(PriceDto(100m, null), "BDT");
        Assert.Null(price.CompareAtAmount);
    }

    [Theory]
    [InlineData(100, 100)]
    [InlineData(100, 99.99)]
    [InlineData(100, 1)]
    public void Price_CompareAtNotAbovePrice_ThrowsCompareAtMustExceedPrice(double amount, double compareAt)
    {
        var price = new SkuPriceAggregate(Guid.NewGuid());
        var ex = Assert.Throws<DomainRuleViolationException>(() => price.Create(PriceDto((decimal)amount, (decimal)compareAt), "BDT"));
        Assert.Equal(BusinessViolationCodes.CompareAtMustExceedPrice, ex.ErrorCode);
        Assert.Empty(price.Events);
    }

    // ── BG-14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static ProductAggregate OrganicRice(DateOnly? certificateExpiresOn, Guid? fileId = null)
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Rice", "Acme", ProductCategory.RiceAndGrains, null, Guid.NewGuid(), "rice", null, null, TestUserContext.Create(), Guid.NewGuid()));
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, "", product.Category, null, [], product.TaxClassId, "BD", true, false,
            [Certification.CertifiedOrganic], TestUserContext.Create(), Guid.NewGuid()));
        product.SetFoodDetails(new FoodDetails("Rice", null, null, null, null, "Board", "ORG-1", certificateExpiresOn, fileId), TestUserContext.Create(), Guid.NewGuid());
        return product;
    }

    private static PublicationFacts Facts(ProductAggregate product, DateOnly? today) => new([product.Skus.Single().Id], true, [], today);

    [Fact]
    public void FoodDetails_KeepsTheExpiryDateAndFile()
    {
        var fileId = Guid.NewGuid();
        var details = new FoodDetails(null, null, null, null, null, "Board", "ORG-1", Today, fileId);
        Assert.Equal(Today, details.OrganicCertificateExpiresOn);
        Assert.Equal(fileId, details.OrganicCertificateFileId);
    }

    [Fact]
    public void FoodDetails_EmptyFileIdIsNoFile()
    {
        Assert.Null(new FoodDetails(null, null, null, null, null, null, null, null, Guid.Empty).OrganicCertificateFileId);
    }

    [Fact]
    public void Certificate_IsValidThroughItsExpiryDate()
    {
        var details = new FoodDetails(null, null, null, null, null, "Board", "ORG-1", Today);
        Assert.False(details.OrganicCertificateExpiredOn(Today.AddDays(-1)));
        Assert.False(details.OrganicCertificateExpiredOn(Today));
        Assert.True(details.OrganicCertificateExpiredOn(Today.AddDays(1)));
    }

    [Fact]
    public void Certificate_WithNoExpiryDateNeverExpires()
    {
        Assert.False(new FoodDetails(null, null, null, null, null, "Board", "ORG-1").OrganicCertificateExpiredOn(Today));
    }

    [Fact]
    public void Publish_CertifiedOrganicWithAnExpiredCertificate_IsBlockedWithOrganicCertificateExpired()
    {
        var product = OrganicRice(Today.AddDays(-1));

        var ex = Assert.Throws<DomainRuleViolationException>(() => product.Publish(Facts(product, Today), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.OrganicCertificateExpired, ex.ErrorCode);
        Assert.Equal(ProductStatus.Draft, product.Status);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(30)]
    public void Publish_CertificateExpiringTodayOrLater_Succeeds(int daysFromToday)
    {
        var product = OrganicRice(Today.AddDays(daysFromToday));
        product.Publish(Facts(product, Today), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(ProductStatus.Active, product.Status);
    }

    [Fact]
    public void Publish_CertificateWithNoRecordedExpiry_Succeeds()
    {
        var product = OrganicRice(null);
        product.Publish(Facts(product, Today), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(ProductStatus.Active, product.Status);
    }

    [Fact]
    public void Publish_ExpiredCertificateOnAProductNotClaimingOrganic_IsNotChecked()
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Rice", "Acme", ProductCategory.RiceAndGrains, null, Guid.NewGuid(), "rice", null, null, TestUserContext.Create(), Guid.NewGuid()));
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "RC-1", null, null, null, null, null), TestUserContext.Create(), Guid.NewGuid());
        product.UpdateDetails(new ProductDetailsUpdateDto(product.Name, product.Brand, "", product.Category, null, [], product.TaxClassId, "BD", true, false, [], TestUserContext.Create(), Guid.NewGuid()));
        product.SetFoodDetails(new FoodDetails(null, null, null, null, null, "Board", "ORG-1", Today.AddYears(-1)), TestUserContext.Create(), Guid.NewGuid());

        product.Publish(Facts(product, Today), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(ProductStatus.Active, product.Status);
    }

    [Fact]
    public void Checklist_ShowsTheExpiryItemOnlyWhenADateIsGiven()
    {
        var product = OrganicRice(Today.AddDays(-1));

        var withDate = ProductPublicationRules.Evaluate(product, Facts(product, Today));
        var item = Assert.Single(withDate, i => i.Item == ProductPublicationRules.OrganicCertificateNotExpired);
        Assert.True(item.IsBlocking);
        Assert.False(item.IsMet);

        var withoutDate = ProductPublicationRules.Evaluate(product, Facts(product, null));
        Assert.DoesNotContain(withoutDate, i => i.Item == ProductPublicationRules.OrganicCertificateNotExpired);
    }

    [Fact]
    public void Unpublished_ProductWithAnExpiredCertificate_CanStillBeEditedAndRenewed()
    {
        var product = OrganicRice(Today.AddDays(-1));

        product.SetFoodDetails(new FoodDetails("Rice", null, null, null, null, "Board", "ORG-2", Today.AddYears(1), Guid.NewGuid()), TestUserContext.Create(), Guid.NewGuid());
        product.Publish(Facts(product, Today), DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());

        Assert.Equal(ProductStatus.Active, product.Status);
    }
}
