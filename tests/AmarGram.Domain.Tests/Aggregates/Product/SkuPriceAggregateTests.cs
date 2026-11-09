using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.Tests.Aggregates.Product;

/// <summary>HO-SHP-001 §15 U-A12.</summary>
public sealed class SkuPriceAggregateTests
{
    private static SkuPriceCreateDto Dto(DateTimeOffset effectiveFrom, DateTimeOffset now, decimal amount = 1500m, string currency = "BDT") =>
        new(Guid.NewGuid(), new Money(amount, currency), effectiveFrom, Guid.NewGuid(), now, TestUserContext.Create(), Guid.NewGuid());

    [Fact]
    public void Create_EffectiveFromTwoMinutesAgo_ThrowsPriceCannotBeBackdated()
    {
        var now = DateTimeOffset.UtcNow;
        var price = new SkuPriceAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => price.Create(Dto(now.AddMinutes(-2), now), "BDT"));
        Assert.Equal(BusinessViolationCodes.PriceCannotBeBackdated, ex.ErrorCode);
    }

    [Fact]
    public void Create_EffectiveFromThirtySecondsAgo_AcceptedWithinSkewTolerance()
    {
        var now = DateTimeOffset.UtcNow;
        var price = new SkuPriceAggregate(Guid.NewGuid());

        price.Create(Dto(now.AddSeconds(-30), now), "BDT");
        Assert.Single(price.Events);
    }

    [Fact]
    public void Create_ZeroAmount_ThrowsPriceMustBePositive()
    {
        var now = DateTimeOffset.UtcNow;
        var price = new SkuPriceAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => price.Create(Dto(now, now, 0m), "BDT"));
        Assert.Equal(BusinessViolationCodes.PriceMustBePositive, ex.ErrorCode);
    }

    [Fact]
    public void Create_WrongCurrency_ThrowsCurrencyMismatch()
    {
        var now = DateTimeOffset.UtcNow;
        var price = new SkuPriceAggregate(Guid.NewGuid());

        var ex = Assert.Throws<DomainRuleViolationException>(() => price.Create(Dto(now, now, 10m, "USD"), "BDT"));
        Assert.Equal(BusinessViolationCodes.CurrencyMismatch, ex.ErrorCode);
    }
}
