using AmarGram.Api.Authorization;
using AmarGram.Api.RateLimiting;
using AmarGram.Infrastructure.Hosting;
using AmarGram.Read.Queries.Product;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Api.Controllers;

/// <summary>HO-SHP-001 section 12.4 -- public storefront catalogue reads (ADR-093:
/// [PublicEndpoint] and [StorefrontEndpoint] on every action; 503 in maintenance mode; cacheable
/// anonymous reads).</summary>
[ApiController]
[Route("api/shop")]
[PublicEndpoint]
[StorefrontEndpoint]
[EnableRateLimiting(ShopRateLimitPolicies.Catalogue)]
public sealed class ShopCatalogueController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? q, [FromQuery] string? category, [FromQuery] string? subcategory,
        [FromQuery] string[]? brand, [FromQuery] string[]? origin, [FromQuery] string[]? district, [FromQuery] string[]? certification,
        [FromQuery] string? minPrice, [FromQuery] string? maxPrice, [FromQuery] string? availability, [FromQuery] int? minRating,
        [FromQuery] string? sort, [FromQuery] int? pageNumber, [FromQuery] int? pageSize, [FromQuery] string? locale)
    {
        if (q is { Length: > ShopSearchRules.MaxQueryLength }) return InvalidFilter("q", "q cannot exceed 100 characters.");

        var brands = brand ?? [];
        var origins = origin ?? [];
        // HO-P3 G1: repeatable free-text district filter (case-insensitive match on the stored name).
        var districts = (district ?? []).Where(d => !string.IsNullOrWhiteSpace(d)).Select(d => d.Trim()).ToArray();
        if (districts.Length > ShopSearchRules.MaxFilterValues) return InvalidFilter("district", $"district cannot have more than {ShopSearchRules.MaxFilterValues} values.");
        if (districts.Any(d => d.Length > ProductRules.DistrictMaxLength)) return InvalidFilter("district", $"district cannot exceed {ProductRules.DistrictMaxLength} characters.");
        var certifications = certification ?? [];

        if (brands.Length > ShopSearchRules.MaxFilterValues) return InvalidFilter("brand", $"brand cannot have more than {ShopSearchRules.MaxFilterValues} values.");
        if (origins.Length > ShopSearchRules.MaxFilterValues) return InvalidFilter("origin", $"origin cannot have more than {ShopSearchRules.MaxFilterValues} values.");
        if (certifications.Length > ShopSearchRules.MaxFilterValues) return InvalidFilter("certification", $"certification cannot have more than {ShopSearchRules.MaxFilterValues} values.");

        // Row 30: every enumerated filter treats an unknown value the same way -- InvalidCatalogueFilter naming
        // the parameter -- rather than ignoring it (which silently widens the result) or matching nothing.
        if (!string.IsNullOrWhiteSpace(category) && !EnumerationParsing.TryParse<ProductCategory>(category, out _))
            return InvalidFilter("category", $"'{category}' is not a known category.");

        if (!string.IsNullOrWhiteSpace(subcategory) && !EnumerationParsing.TryParse<ProductSubcategory>(subcategory, out _))
            return InvalidFilter("subcategory", $"'{subcategory}' is not a known subcategory.");

        foreach (var value in origins)
            if (!CountryCodes.IsValid(value)) return InvalidFilter("origin", $"'{value}' is not a known country code.");

        foreach (var value in certifications)
            if (!EnumerationParsing.TryParse<Certification>(value, out _)) return InvalidFilter("certification", $"'{value}' is not a known certification.");

        decimal? minPriceValue = null, maxPriceValue = null;
        if (!string.IsNullOrWhiteSpace(minPrice))
        {
            if (!decimal.TryParse(minPrice, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsedMin)) return InvalidFilter("minPrice", "minPrice must be a number.");
            minPriceValue = parsedMin;
        }

        if (!string.IsNullOrWhiteSpace(maxPrice))
        {
            if (!decimal.TryParse(maxPrice, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsedMax)) return InvalidFilter("maxPrice", "maxPrice must be a number.");
            maxPriceValue = parsedMax;
        }

        if (minPriceValue is not null && maxPriceValue is not null && minPriceValue > maxPriceValue)
            return InvalidFilter("minPrice", "minPrice cannot exceed maxPrice.");

        if (minRating is < 1 or > 5) return InvalidFilter("minRating", "minRating must be between 1 and 5.");

        if (pageSize is > ShopSearchRules.MaxPageSize) return InvalidFilter("pageSize", $"pageSize cannot exceed {ShopSearchRules.MaxPageSize}.");
        if (pageNumber is > PagingRules.MaxPageNumber) return InvalidFilter("pageNumber", $"pageNumber cannot exceed {PagingRules.MaxPageNumber}.");

        var query = new GetCatalogueQuery
        {
            Q = q, Category = category, Subcategory = subcategory, Brand = brands, Origin = origins, District = districts, Certification = certifications,
            MinPrice = minPriceValue, MaxPrice = maxPriceValue, AvailabilityInStock = availability == "inStock" ? true : null, MinRating = minRating,
            Sort = sort, Locale = locale, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(),
            PageSize = pageSize is > 0 ? Math.Min(pageSize.Value, ShopSearchRules.MaxPageSize) : ShopSearchRules.DefaultPageSize
        };
        if (pageNumber is > 0) query.PageNumber = pageNumber.Value;

        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(query);
        return Ok(response.Result);
    }

    [HttpGet("filters")]
    public async Task<IActionResult> GetFilters([FromQuery] string? category)
    {
        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(new GetCatalogueFiltersQuery
        { Category = category, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });

        return Ok(response.Result);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(new GetCategoriesQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }

    /// <summary>HO-P3 G5 -- <c>{ currencyCode, freeOver, leadTimeDays, zoneName }</c>: the primary zone's Standard free-delivery threshold and lead time, for guests
    /// (the signed-in checkout quote stays authoritative per address). All null when no zone is configured.</summary>
    [HttpGet("delivery-promise")]
    public async Task<IActionResult> GetDeliveryPromise()
    {
        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(new AmarGram.Read.Queries.Order.GetDeliveryPromiseQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }

    [HttpGet("origins")]
    public async Task<IActionResult> GetOrigins()
    {
        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(new GetOriginsQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }

    /// <summary>US-SHP-14 -- <c>{ defaultLocale, locales[] }</c> from configuration (default
    /// <c>["en"]</c>, SRS Q-12: no second language enabled until the owner decides).</summary>
    [HttpGet("locales")]
    public async Task<IActionResult> GetLocales()
    {
        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(new GetLocalesQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }

    [HttpGet("origins/{countryCode}")]
    public async Task<IActionResult> GetOrigin(string countryCode)
    {
        var response = await dispatcher.GetResultAsync(new GetOriginQuery
        { CountryCode = countryCode, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });

        if (response.Result is null) return NotFound();
        Response.Headers.CacheControl = "public, max-age=60";
        return Ok(response.Result);
    }

    [HttpGet("products/{slug}")]
    public async Task<IActionResult> GetDetail(string slug, [FromQuery] string? locale)
    {
        var response = await dispatcher.GetResultAsync(new GetProductDetailQuery
        { Slug = slug, Locale = locale, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });

        if (response.Result is null) return NotFound();
        Response.Headers.CacheControl = "public, max-age=60";
        return Ok(response.Result);
    }

    /// <summary>US-SHP-08 -- curated blocks plus the computed life-stage block. With a customer
    /// session the response is personal (<c>private, no-store</c>); anonymous callers get the
    /// cacheable form (section 12.4).</summary>
    [HttpGet("products/{slug}/recommendations")]
    public async Task<IActionResult> GetRecommendations(string slug, [FromQuery] string? locale)
    {
        var caller = HttpContext.Items[ResolvedCaller.HttpContextItemsKey] as ResolvedCaller ?? ResolvedCaller.Anonymous;
        Guid? customerId = caller.Kind == ResolvedCallerKind.Customer ? caller.AccountId : null;

        var response = await dispatcher.GetResultAsync(new GetProductRecommendationsQuery
        { Slug = slug, CustomerId = customerId, Locale = locale, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });

        if (response.Result is null) return NotFound();
        Response.Headers.CacheControl = customerId is null ? "public, max-age=60" : "private, no-store";
        return Ok(response.Result);
    }

    [HttpGet("products/{slug}/reviews")]
    public async Task<IActionResult> GetReviews(string slug, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        var query = new GetProductReviewsQuery { Slug = slug, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() };

        var pagingError = PagingHelper.ApplyPaging(query, pageNumber, pageSize);
        if (pagingError is not null) return pagingError;

        Response.Headers.CacheControl = "public, max-age=60";
        var response = await dispatcher.GetResultAsync(query);
        return Ok(response.Result);
    }

    private IActionResult InvalidFilter(string parameter, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: parameter, errorCode: BusinessViolationCodes.InvalidCatalogueFilter, resourceName: "Catalogue");
        return BadRequest(validationResponse);
    }
}
