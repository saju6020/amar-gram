using AmarGram.Application.Commands.Product;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Application.DataMappers;

/// <summary>HO-SHP-001 section 11.3. command.UserContext and command.CorrelationId are always
/// passed through -- how the audit trail attributes a change. Enum-typed fields are parsed by the
/// caller (the handler, via <c>EnumerationParsing</c>) before reaching these mappers, since a
/// mapper failure has nowhere good to report a 400 from.</summary>
public static class ProductMapper
{
    public static ProductCreateDto ToDomainDto(this CreateProductCommand command, ProductKind kind, ProductCategory category, ProductSubcategory? subcategory) =>
        new(kind, command.Name, command.Brand, category, subcategory, command.TaxClassId, command.Slug,
            command.BundleSkuId, command.BundleSkuCode, command.UserContext, command.CorrelationId);

    public static ProductDetailsUpdateDto ToDomainDto(this UpdateProductDetailsCommand command, ProductCategory category, ProductSubcategory? subcategory, IReadOnlyList<Certification> certifications) =>
        new(command.Name, command.Brand, command.Description ?? "", category, subcategory, command.Tags,
            command.TaxClassId, command.CountryOfOriginCode, command.ListedOnStorefront, command.IsExpiryTracked,
            certifications, command.UserContext, command.CorrelationId, command.DistrictOfOrigin);

    public static SkuAddDto ToDomainDto(this AddSkuCommand command) =>
        new(command.SkuId, command.Code, command.Barcode, command.SizeOrWeight, command.Flavour, command.Colour, command.PackQuantity, command.ShippingWeightGrams);

    public static SkuUpdateDto ToDomainDto(this UpdateSkuCommand command) =>
        new(command.SkuId, command.SizeOrWeight, command.Flavour, command.Colour, command.PackQuantity, command.ShippingWeightGrams);

    public static IReadOnlyList<ProductImageInputDto> ToDomainDto(this SetProductImagesCommand command) =>
        command.Images.Select(i => new ProductImageInputDto(i.ImageId, i.SkuId, i.FileId, i.AltText, i.SortOrder, i.IsPrimary)).ToList();

    public static SkuPriceCreateDto ToDomainDto(this ScheduleSkuPriceCommand command, DateTimeOffset now) =>
        new(command.SkuId, new Money(command.Amount, command.CurrencyCode), command.EffectiveFrom, command.UserContext.UserId, now, command.UserContext, command.CorrelationId, command.CompareAtAmount);

    public static FoodDetails ToDomainDto(this SetFoodDetailsCommand command) =>
        new(command.IngredientList, command.StorageInstructions, command.ShelfLife, command.NetWeight,
            command.Allergens, command.OrganicCertifier, command.OrganicCertificateNumber,
            command.OrganicCertificateExpiresOn, command.OrganicCertificateFileId);

    public static SourcingOriginCreateDto ToDomainDto(this CreateSourcingOriginCommand command) =>
        new(command.CountryCode, command.SourcingNotes, command.IsFeatured, command.SortOrder, command.UserContext, command.CorrelationId);

    public static SourcingOriginUpdateDto ToDomainDto(this UpdateSourcingOriginCommand command) =>
        new(command.SourcingNotes, command.IsFeatured, command.SortOrder, command.UserContext, command.CorrelationId);
}
