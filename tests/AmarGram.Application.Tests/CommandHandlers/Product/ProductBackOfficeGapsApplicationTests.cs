using AmarGram.Application.CommandHandlers.Product;
using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Product;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Aggregates.StoredFile;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Fakes.Administration;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.Tests.CommandHandlers.Product;

/// <summary>HO-P4 BG-10 (bulk publish/hide), BG-13 (compare-at price) and BG-14 (organic certificate file).</summary>
public sealed class ProductBackOfficeGapsApplicationTests
{
    private static UserContext Manager() => new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["ShopManager"] };

    private static ProductAggregate Draft(ProductCategory? category = null, string slug = "p")
    {
        var product = new ProductAggregate(Guid.NewGuid());
        product.Create(new ProductCreateDto(ProductKind.Standard, "Item", "Acme", category ?? ProductCategory.HouseholdAndCare, null, Guid.NewGuid(), slug, null, null, Manager(), Guid.NewGuid()));
        product.AddSku(new SkuAddDto(Guid.NewGuid(), "SKU-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant(), null, null, null, null, null), Manager(), Guid.NewGuid());
        return product;
    }

    private static ProductAggregate Active()
    {
        var product = Draft();
        product.Publish(new PublicationFacts([product.Skus.Single().Id], true, []), DateTimeOffset.UtcNow, Manager(), Guid.NewGuid());
        return product;
    }

    // ── BG-13 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static ScheduleSkuPriceCommandHandler PriceHandler(ProductAggregate product, out FakeAggregateRootRepository<SkuPriceAggregate> prices, FakeTimeProvider time)
    {
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(product);
        prices = new FakeAggregateRootRepository<SkuPriceAggregate>();
        var settings = new InMemoryBusinessSettings(new Dictionary<string, object> { ["commerce.currencyCode"] = "BDT" });
        return new ScheduleSkuPriceCommandHandler(NullLogger<ScheduleSkuPriceCommandHandler>.Instance, products, prices, settings, time);
    }

    private static ScheduleSkuPriceCommand PriceCommand(Guid skuId, decimal amount, decimal? compareAt, DateTimeOffset at) => new()
    {
        SkuPriceId = Guid.NewGuid(), SkuId = skuId, Amount = amount, CurrencyCode = "BDT", EffectiveFrom = at, CompareAtAmount = compareAt,
        UserContext = Manager(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
    };

    [Fact]
    public async Task BG13_SchedulePrice_WithCompareAt_StoresIt()
    {
        var product = Draft();
        var time = new FakeTimeProvider(DateTimeOffset.UtcNow);
        var handler = PriceHandler(product, out var prices, time);

        var response = await handler.HandleAsync(PriceCommand(product.Skus.Single().Id, 100m, 130m, time.GetUtcNow()));

        Assert.True(response.IsSuccess);
        Assert.Equal(130m, prices.Saved.Single().CompareAtAmount);
    }

    [Theory]
    [InlineData(100, 100)]
    [InlineData(100, 80)]
    public async Task BG13_SchedulePrice_CompareAtNotAbovePrice_ReturnsCompareAtMustExceedPrice_AndSavesNothing(double amount, double compareAt)
    {
        var product = Draft();
        var time = new FakeTimeProvider(DateTimeOffset.UtcNow);
        var handler = PriceHandler(product, out var prices, time);

        var response = await handler.HandleAsync(PriceCommand(product.Skus.Single().Id, (decimal)amount, (decimal)compareAt, time.GetUtcNow()));

        Assert.False(response.IsSuccess);
        var error = Assert.Single(response.ValidationResult!.Errors);
        Assert.Equal(BusinessViolationCodes.CompareAtMustExceedPrice, error.ErrorCode);
        Assert.Empty(prices.Saved);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(100.005, false)]
    [InlineData(100.50, true)]
    public void BG13_Validator_ChecksTheCompareAtShapeLikeThePrice(double compareAt, bool valid)
    {
        var result = new ScheduleSkuPriceCommandValidator().Validate(PriceCommand(Guid.NewGuid(), 50m, (decimal)compareAt, DateTimeOffset.UtcNow));
        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public void BG13_Validator_AcceptsNoCompareAt()
    {
        Assert.True(new ScheduleSkuPriceCommandValidator().Validate(PriceCommand(Guid.NewGuid(), 50m, null, DateTimeOffset.UtcNow)).IsValid);
    }

    // ── BG-14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private static StoredFileAggregate CertificateFile(Guid uploadedBy, DateTimeOffset uploadedOn, FilePurpose? purpose = null)
    {
        var file = new StoredFileAggregate(Guid.NewGuid());
        file.Register(new StoredFileRegistrationDto(
            file.Id, purpose ?? FilePurpose.OrganicCertificate, "application/pdf", 2048, new string('a', 64), "certificate.pdf",
            "OrganicCertificate/2026/10/" + Guid.NewGuid().ToString("N"), uploadedBy, uploadedOn, "DevelopmentNoOp", null, Manager(), Guid.NewGuid()));
        return file;
    }

    private static (SetFoodDetailsCommandHandler Handler, ProductAggregate Product, FakeAggregateRootRepository<ProductAggregate> Products, FakeAggregateRootRepository<StoredFileAggregate> Files, FakeTimeProvider Time)
        FoodSetup()
    {
        var product = Draft(ProductCategory.RiceAndGrains);
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(product);
        var files = new FakeAggregateRootRepository<StoredFileAggregate>();
        var time = new FakeTimeProvider(DateTimeOffset.UtcNow);
        return (new SetFoodDetailsCommandHandler(NullLogger<SetFoodDetailsCommandHandler>.Instance, products, files, time), product, products, files, time);
    }

    private static SetFoodDetailsCommand FoodCommand(ProductAggregate product, UserContext user, Guid? fileId, DateOnly? expires = null) => new()
    {
        ProductId = product.Id, ExpectedVersion = product.Version, OrganicCertifier = "Board", OrganicCertificateNumber = "ORG-1",
        OrganicCertificateExpiresOn = expires, OrganicCertificateFileId = fileId, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true
    };

    [Fact]
    public async Task BG14_SetFoodDetails_WithAFreshOwnCertificateFile_StoresExpiryAndFile()
    {
        var (handler, product, _, files, time) = FoodSetup();
        var user = Manager();
        var file = CertificateFile(user.UserId, time.GetUtcNow().AddMinutes(-5));
        files.Seed(file);
        var expires = new DateOnly(2027, 3, 31);

        var response = await handler.HandleAsync(FoodCommand(product, user, file.Id, expires));

        Assert.True(response.IsSuccess);
        Assert.Equal(file.Id, product.FoodDetails!.OrganicCertificateFileId);
        Assert.Equal(expires, product.FoodDetails.OrganicCertificateExpiresOn);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_UnknownFile_ReturnsInvalidCertificateFile()
    {
        var (handler, product, _, _, _) = FoodSetup();

        var response = await handler.HandleAsync(FoodCommand(product, Manager(), Guid.NewGuid()));

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidCertificateFile);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_AFileOfAnotherPurpose_ReturnsInvalidCertificateFile()
    {
        var (handler, product, _, files, time) = FoodSetup();
        var user = Manager();
        var image = new StoredFileAggregate(Guid.NewGuid());
        image.Register(new StoredFileRegistrationDto(image.Id, FilePurpose.ProductImage, "image/png", 100, new string('b', 64), "x.png",
            "ProductImage/2026/10/" + Guid.NewGuid().ToString("N"), user.UserId, time.GetUtcNow(), "DevelopmentNoOp", null, user, Guid.NewGuid()));
        files.Seed(image);

        var response = await handler.HandleAsync(FoodCommand(product, user, image.Id));

        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidCertificateFile);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_SomeoneElsesFile_ReturnsInvalidCertificateFile()
    {
        var (handler, product, _, files, time) = FoodSetup();
        var file = CertificateFile(Guid.NewGuid(), time.GetUtcNow());
        files.Seed(file);

        var response = await handler.HandleAsync(FoodCommand(product, Manager(), file.Id));

        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidCertificateFile);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_AFileAlreadyOnAnotherProduct_ReturnsInvalidCertificateFile()
    {
        var (handler, product, products, files, time) = FoodSetup();
        var user = Manager();
        var file = CertificateFile(user.UserId, time.GetUtcNow());
        files.Seed(file);

        var other = Draft(ProductCategory.RiceAndGrains, "other");
        other.SetFoodDetails(new FoodDetails(null, null, null, null, null, "Board", "ORG-9", null, file.Id), user, Guid.NewGuid());
        products.Seed(other);

        var response = await handler.HandleAsync(FoodCommand(product, user, file.Id));

        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidCertificateFile);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_ResubmittingTheFileTheProductAlreadyHolds_SkipsTheAttachWindow()
    {
        var (handler, product, _, files, time) = FoodSetup();
        var user = Manager();
        var file = CertificateFile(user.UserId, time.GetUtcNow());
        files.Seed(file);
        Assert.True((await handler.HandleAsync(FoodCommand(product, user, file.Id))).IsSuccess);

        time.Advance(TimeSpan.FromHours(3)); // far beyond the 30-minute attach window

        var response = await handler.HandleAsync(FoodCommand(product, user, file.Id, new DateOnly(2028, 1, 1)));

        Assert.True(response.IsSuccess);
        Assert.Equal(new DateOnly(2028, 1, 1), product.FoodDetails!.OrganicCertificateExpiresOn);
    }

    [Fact]
    public async Task BG14_SetFoodDetails_NullFile_RemovesIt()
    {
        var (handler, product, _, files, time) = FoodSetup();
        var user = Manager();
        var file = CertificateFile(user.UserId, time.GetUtcNow());
        files.Seed(file);
        await handler.HandleAsync(FoodCommand(product, user, file.Id));

        var response = await handler.HandleAsync(FoodCommand(product, user, null));

        Assert.True(response.IsSuccess);
        Assert.Null(product.FoodDetails!.OrganicCertificateFileId);
    }

    // ── BG-10 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    private sealed class ScriptedHandler<TCommand>(Func<TCommand, CommandResponse> script) : ICommandHandlerAsync<TCommand> where TCommand : Command
    {
        public List<TCommand> Seen { get; } = [];

        public Task<CommandResponse> HandleAsync(TCommand command)
        {
            Seen.Add(command);
            return Task.FromResult(script(command));
        }
    }

    private static CommandResponse Refused(string code, string property, string message)
    {
        var validation = new ValidationResponse();
        validation.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: nameof(ProductAggregate));
        return new CommandResponse { IsSuccess = false, ValidationResult = validation };
    }

    private static BulkChangeProductStatusCommand Bulk(string action, params Guid[] ids) => new()
    { ProductIds = ids, Action = action, UserContext = Manager(), CorrelationId = Guid.NewGuid(), ValidateCommand = true };

    [Fact]
    public async Task BG10_BulkPublish_ReportsEachProduct_OneFailureNeverStopsTheOthers()
    {
        var good = Draft();
        var blocked = Draft(slug: "blocked");
        var missing = Guid.NewGuid();
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(good);
        products.Seed(blocked);
        var publish = new ScriptedHandler<PublishProductCommand>(c => c.ProductId == blocked.Id
            ? Refused(BusinessViolationCodes.ProductNotPublishable, "Status", "Set a price for SKU X.")
            : new CommandResponse { IsSuccess = true });
        var unpublish = new ScriptedHandler<UnpublishProductCommand>(_ => new CommandResponse { IsSuccess = true });
        var handler = new BulkChangeProductStatusCommandHandler(NullLogger<BulkChangeProductStatusCommandHandler>.Instance, products, publish, unpublish);

        var response = await handler.HandleAsync(Bulk(BulkProductActions.Publish, good.Id, blocked.Id, missing));

        Assert.True(response.IsSuccess);
        var result = Assert.IsType<BulkProductStatusResult>(response.Result);
        Assert.Equal(1, result.SucceededCount);
        Assert.Equal(2, result.FailedCount);
        Assert.Equal([good.Id, blocked.Id, missing], result.Items.Select(i => i.ProductId));

        Assert.True(result.Items[0].Succeeded);
        Assert.Equal("Active", result.Items[0].Status);
        Assert.False(result.Items[1].Succeeded);
        Assert.Equal(BusinessViolationCodes.ProductNotPublishable, result.Items[1].ErrorCode);
        Assert.Equal("Set a price for SKU X.", result.Items[1].Message);
        Assert.Equal(BusinessViolationCodes.ProductNotFound, result.Items[2].ErrorCode);
        Assert.Empty(unpublish.Seen);
    }

    [Fact]
    public async Task BG10_Bulk_UsesEachProductsCurrentVersion_NoVersionIsNeededFromTheCaller()
    {
        var one = Draft();
        var two = Draft(slug: "two");
        two.ChangeSlug("two-renamed", Manager(), Guid.NewGuid()); // bump the version
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(one);
        products.Seed(two);
        var publish = new ScriptedHandler<PublishProductCommand>(_ => new CommandResponse { IsSuccess = true });
        var handler = new BulkChangeProductStatusCommandHandler(NullLogger<BulkChangeProductStatusCommandHandler>.Instance, products, publish,
            new ScriptedHandler<UnpublishProductCommand>(_ => new CommandResponse { IsSuccess = true }));

        await handler.HandleAsync(Bulk(BulkProductActions.Publish, one.Id, two.Id));

        Assert.Equal(one.Version, publish.Seen.Single(c => c.ProductId == one.Id).ExpectedVersion);
        Assert.Equal(two.Version, publish.Seen.Single(c => c.ProductId == two.Id).ExpectedVersion);
        Assert.NotEqual(one.Version, two.Version);
    }

    [Fact]
    public async Task BG10_BulkHide_UnpublishesActiveProducts_AndReportsADraftAsAnInvalidTransition()
    {
        var live = Active();
        var draft = Draft(slug: "d");
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(live);
        products.Seed(draft);
        var handler = new BulkChangeProductStatusCommandHandler(
            NullLogger<BulkChangeProductStatusCommandHandler>.Instance, products,
            new ScriptedHandler<PublishProductCommand>(_ => new CommandResponse { IsSuccess = true }),
            new UnpublishProductCommandHandler(NullLogger<UnpublishProductCommandHandler>.Instance, products));

        var response = await handler.HandleAsync(Bulk(BulkProductActions.Unpublish, live.Id, draft.Id));

        var result = Assert.IsType<BulkProductStatusResult>(response.Result);
        Assert.Equal(ProductStatus.Draft, live.Status);
        Assert.True(result.Items[0].Succeeded);
        Assert.Equal("Draft", result.Items[0].Status);
        Assert.Equal(BusinessViolationCodes.InvalidProductTransition, result.Items[1].ErrorCode);
    }

    [Fact]
    public async Task BG10_Bulk_ADuplicatedIdIsHandledOnce()
    {
        var product = Draft();
        var products = new FakeAggregateRootRepository<ProductAggregate>();
        products.Seed(product);
        var publish = new ScriptedHandler<PublishProductCommand>(_ => new CommandResponse { IsSuccess = true });
        var handler = new BulkChangeProductStatusCommandHandler(NullLogger<BulkChangeProductStatusCommandHandler>.Instance, products, publish,
            new ScriptedHandler<UnpublishProductCommand>(_ => new CommandResponse { IsSuccess = true }));

        var response = await handler.HandleAsync(Bulk(BulkProductActions.Publish, product.Id, product.Id));

        Assert.Single(((BulkProductStatusResult)response.Result!).Items);
        Assert.Single(publish.Seen);
    }

    [Fact]
    public async Task BG10_Bulk_UnknownAction_IsRefusedWholesale()
    {
        var handler = new BulkChangeProductStatusCommandHandler(
            NullLogger<BulkChangeProductStatusCommandHandler>.Instance, new FakeAggregateRootRepository<ProductAggregate>(),
            new ScriptedHandler<PublishProductCommand>(_ => new CommandResponse { IsSuccess = true }),
            new ScriptedHandler<UnpublishProductCommand>(_ => new CommandResponse { IsSuccess = true }));

        var response = await handler.HandleAsync(Bulk("Archive", Guid.NewGuid()));

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidBulkAction);
    }

    [Fact]
    public void BG10_Validator_RequiresBetweenOneAndAHundredRealIdsAndAKnownAction()
    {
        var validator = new BulkChangeProductStatusCommandValidator();

        Assert.True(validator.Validate(Bulk(BulkProductActions.Publish, Guid.NewGuid())).IsValid);
        Assert.False(validator.Validate(Bulk(BulkProductActions.Publish)).IsValid);
        Assert.False(validator.Validate(Bulk(BulkProductActions.Publish, Guid.Empty)).IsValid);
        Assert.False(validator.Validate(Bulk("Delete", Guid.NewGuid())).IsValid);
        Assert.True(validator.Validate(Bulk(BulkProductActions.Unpublish, Enumerable.Range(0, ProductRules.MaxBulkProducts).Select(_ => Guid.NewGuid()).ToArray())).IsValid);
        Assert.False(validator.Validate(Bulk(BulkProductActions.Unpublish, Enumerable.Range(0, ProductRules.MaxBulkProducts + 1).Select(_ => Guid.NewGuid()).ToArray())).IsValid);
    }
}
