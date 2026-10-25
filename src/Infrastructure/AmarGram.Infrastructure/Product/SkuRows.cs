using AmarGram.Domain.Entities;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Product;

/// <summary>
/// One SKU with the columns of its product that the read side needs -- a projection, never an
/// aggregate (.ai/read-side-pattern.md section 4 rules 1-2, ADR-012). A class with settable members
/// (not a positional record) so EF can compose <c>Where</c> over it after the projection.
/// </summary>
public sealed class SkuRow
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = default!;
    public string? Barcode { get; set; }
    public SkuStatus SkuStatus { get; set; } = default!;
    public string? SizeOrWeight { get; set; }
    public string? Flavour { get; set; }
    public string? Colour { get; set; }
    public int? PackQuantity { get; set; }
    public int? ShippingWeightGrams { get; set; }

    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = default!;
    public string Brand { get; set; } = default!;
    public string ProductSlug { get; set; } = default!;
    public ProductKind Kind { get; set; } = default!;
    public ProductStatus ProductStatus { get; set; } = default!;
    public bool ListedOnStorefront { get; set; }
    public Guid TaxClassId { get; set; }
    public ProductCategory Category { get; set; } = default!;
    public bool IsExpiryTracked { get; set; }
    public string? CountryOfOriginCode { get; set; }

    public string Label => Sku.LabelFor(ProductName, SizeOrWeight, Flavour, Colour, PackQuantity);
    public bool HasAnyAxis => !string.IsNullOrWhiteSpace(SizeOrWeight) || !string.IsNullOrWhiteSpace(Flavour) || !string.IsNullOrWhiteSpace(Colour) || PackQuantity is not null;
    public bool ProductOnSale => ProductStatus == ProductStatus.Active && ListedOnStorefront;
    public bool SkuOnSale => ProductOnSale && SkuStatus == SkuStatus.Active;
    public bool IsFood => Category.IsFood;
}

/// <summary>One bundle component (a projected owned row).</summary>
public sealed class BundleComponentRow
{
    public Guid ProductId { get; set; }
    public Guid ComponentSkuId { get; set; }
    public int Quantity { get; set; }
}

/// <summary>A price row projected from <c>product.sku_price</c>.</summary>
public sealed class PriceRow
{
    public Guid Id { get; set; }
    public Guid SkuId { get; set; }
    public decimal Amount { get; set; }
    /// <summary>HO-P4 BG-13 -- the optional "Was" amount of this price row.</summary>
    public decimal? CompareAtAmount { get; set; }
    public string CurrencyCode { get; set; } = default!;
    public DateTimeOffset EffectiveFrom { get; set; }
    public Guid SetBy { get; set; }
}

public static class ProductProjections
{
    /// <summary>Every SKU joined to its product's columns -- the owned <c>sku</c> table is reached
    /// with <c>SelectMany</c>, so one SQL join, no aggregate graph.</summary>
    public static IQueryable<SkuRow> SkuRows(this AmarGramDbContext db) =>
        db.Products.AsNoTracking().SelectMany(p => p.Skus, (p, s) => new SkuRow
        {
            SkuId = s.Id, SkuCode = s.Code, Barcode = s.Barcode, SkuStatus = s.Status,
            SizeOrWeight = s.SizeOrWeight, Flavour = s.Flavour, Colour = s.Colour, PackQuantity = s.PackQuantity, ShippingWeightGrams = s.ShippingWeightGrams,
            ProductId = p.Id, ProductName = p.Name, Brand = p.Brand, ProductSlug = p.Slug, Kind = p.Kind, ProductStatus = p.Status,
            ListedOnStorefront = p.ListedOnStorefront, TaxClassId = p.TaxClassId,
            Category = p.Category, IsExpiryTracked = p.IsExpiryTracked, CountryOfOriginCode = p.CountryOfOriginCode
        });

    public static IQueryable<BundleComponentRow> BundleComponentRows(this AmarGramDbContext db) =>
        db.Products.AsNoTracking().SelectMany(p => p.BundleComponents, (p, c) => new BundleComponentRow
        { ProductId = p.Id, ComponentSkuId = c.ComponentSkuId, Quantity = c.Quantity });

    public static IQueryable<PriceRow> PriceRows(this AmarGramDbContext db) =>
        db.SkuPrices.AsNoTracking().Select(p => new PriceRow
        { Id = p.Id, SkuId = p.SkuId, Amount = p.Amount.Amount, CompareAtAmount = p.CompareAtAmount, CurrencyCode = p.Amount.CurrencyCode, EffectiveFrom = p.EffectiveFrom, SetBy = p.SetBy });
}
