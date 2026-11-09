using AmarGram.Application.CommandHandlers.Product;
using AmarGram.Application.Commands.Product;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Fakes.Administration;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Product;

public sealed class ScheduleSkuPriceCommandHandlerTests
{
    private static UserContext ShopManagerContext() => new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["ShopManager"] };

    private static ProductAggregate ProductWithSku(Guid skuId)
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Bamboo Broom", "Acme", ProductCategory.HouseholdAndCare,
            null, Guid.NewGuid(), "bamboo-broom", null, null, ShopManagerContext(), Guid.NewGuid()));
        product.AddSku(new SkuAddDto(skuId, "SP-1", null, null, null, null, null), ShopManagerContext(), Guid.NewGuid());
        return product;
    }

    [Fact]
    public async Task Schedule_Valid_Succeeds()
    {
        var skuId = Guid.NewGuid();
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        productRepository.Seed(ProductWithSku(skuId));
        var priceRepository = new FakeAggregateRootRepository<SkuPriceAggregate>();
        var settings = new InMemoryBusinessSettings(new Dictionary<string, object> { ["commerce.currencyCode"] = "BDT" });
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);

        var handler = new ScheduleSkuPriceCommandHandler(NullLogger<ScheduleSkuPriceCommandHandler>.Instance, productRepository, priceRepository, settings, timeProvider);
        var response = await handler.HandleAsync(new ScheduleSkuPriceCommand
        {
            SkuPriceId = Guid.NewGuid(), SkuId = skuId, Amount = 1500m, CurrencyCode = "BDT", EffectiveFrom = timeProvider.GetUtcNow(),
            UserContext = ShopManagerContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        Assert.True(response.IsSuccess);
        Assert.Single(priceRepository.Saved);
    }

    [Fact]
    public async Task Schedule_UnknownSku_ReturnsSkuNotFound()
    {
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        var priceRepository = new FakeAggregateRootRepository<SkuPriceAggregate>();
        var settings = new InMemoryBusinessSettings(new Dictionary<string, object> { ["commerce.currencyCode"] = "BDT" });
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);

        var handler = new ScheduleSkuPriceCommandHandler(NullLogger<ScheduleSkuPriceCommandHandler>.Instance, productRepository, priceRepository, settings, timeProvider);
        var response = await handler.HandleAsync(new ScheduleSkuPriceCommand
        {
            SkuPriceId = Guid.NewGuid(), SkuId = Guid.NewGuid(), Amount = 1500m, CurrencyCode = "BDT", EffectiveFrom = timeProvider.GetUtcNow(),
            UserContext = ShopManagerContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.SkuNotFound);
    }

    [Fact]
    public async Task Schedule_DuplicateEffectiveDate_ReturnsDuplicatePriceEffectiveDate()
    {
        var skuId = Guid.NewGuid();
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        productRepository.Seed(ProductWithSku(skuId));
        var priceRepository = new FakeAggregateRootRepository<SkuPriceAggregate>();
        var settings = new InMemoryBusinessSettings(new Dictionary<string, object> { ["commerce.currencyCode"] = "BDT" });
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
        var effectiveFrom = timeProvider.GetUtcNow();

        var existing = new SkuPriceAggregate(Guid.NewGuid());
        existing.Create(new SkuPriceCreateDto(skuId, new AmarGram.Domain.ValueObjects.Money(1000m, "BDT"), effectiveFrom, Guid.NewGuid(), effectiveFrom, ShopManagerContext(), Guid.NewGuid()), "BDT");
        priceRepository.Seed(existing);

        var handler = new ScheduleSkuPriceCommandHandler(NullLogger<ScheduleSkuPriceCommandHandler>.Instance, productRepository, priceRepository, settings, timeProvider);
        var response = await handler.HandleAsync(new ScheduleSkuPriceCommand
        {
            SkuPriceId = Guid.NewGuid(), SkuId = skuId, Amount = 1500m, CurrencyCode = "BDT", EffectiveFrom = effectiveFrom,
            UserContext = ShopManagerContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.DuplicatePriceEffectiveDate);
    }
}
