using AmarGram.Application.CommandHandlers.Product;
using AmarGram.Application.Commands.Product;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using Microsoft.Extensions.Logging.Abstractions;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Product;

/// <summary>HO-SHP-001 §16 I-A3, I-A7 (the handler-level slice of the barcode/slug pre-checks).</summary>
public sealed class CreateProductCommandHandlerTests
{
    private static UserContext ShopManagerContext() => new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["ShopManager"] };

    private static TaxClassAggregate ActiveTaxClass()
    {
        var taxClass = new TaxClassAggregate(Guid.NewGuid());
        taxClass.Create(new TaxClassCreateDto("STD", "Standard", ShopManagerContext(), Guid.NewGuid()));
        return taxClass;
    }

    private static CreateProductCommand ValidCommand(Guid taxClassId, string slug = "organic-dry-mix") => new()
    {
        ProductId = Guid.NewGuid(), Kind = "Standard", Name = "Organic Dry Mix", Brand = "Amar Gram",
        Category = "CatFood", Subcategory = "Dry", TaxClassId = taxClassId, Slug = slug,
        UserContext = ShopManagerContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
    };

    [Fact]
    public async Task Create_Valid_Succeeds()
    {
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        var taxClassRepository = new FakeAggregateRootRepository<TaxClassAggregate>();
        var taxClass = ActiveTaxClass();
        taxClassRepository.Seed(taxClass);

        var handler = new CreateProductCommandHandler(NullLogger<CreateProductCommandHandler>.Instance, productRepository, taxClassRepository);
        var response = await handler.HandleAsync(ValidCommand(taxClass.Id));

        Assert.True(response.IsSuccess);
        Assert.Single(productRepository.Saved);
    }

    [Fact]
    public async Task Create_DuplicateSlug_ReturnsSlugAlreadyInUse()
    {
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        var taxClassRepository = new FakeAggregateRootRepository<TaxClassAggregate>();
        var taxClass = ActiveTaxClass();
        taxClassRepository.Seed(taxClass);

        var existing = new ProductAggregate(Guid.NewGuid());
        existing.Create(new ProductCreateDto(AmarGram.Shared.Common.Enums.ProductKind.Standard, "Existing", "Brand",
            AmarGram.Shared.Common.Enums.ProductCategory.ToysAndFurniture, null, taxClass.Id, "organic-dry-mix",
            null, null, ShopManagerContext(), Guid.NewGuid()));
        productRepository.Seed(existing);

        var handler = new CreateProductCommandHandler(NullLogger<CreateProductCommandHandler>.Instance, productRepository, taxClassRepository);
        var response = await handler.HandleAsync(ValidCommand(taxClass.Id));

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.SlugAlreadyInUse);
    }

    [Fact]
    public async Task Create_TaxClassNotFound_ReturnsTaxClassNotFound()
    {
        var productRepository = new FakeAggregateRootRepository<ProductAggregate>();
        var taxClassRepository = new FakeAggregateRootRepository<TaxClassAggregate>();

        var handler = new CreateProductCommandHandler(NullLogger<CreateProductCommandHandler>.Instance, productRepository, taxClassRepository);
        var response = await handler.HandleAsync(ValidCommand(Guid.NewGuid()));

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.TaxClassNotFound);
    }
}
