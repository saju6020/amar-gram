using AmarGram.Domain.ValueObjects;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-SHP-001 section 8.5 / section 11.1 C6. <c>CompareAtAmount</c> (HO-P4 BG-13) is the optional "Was" price
/// shown struck through beside this price; it is in the same currency and must exceed <c>Amount</c>.</summary>
public sealed record SkuPriceCreateDto(
    Guid SkuId,
    Money Amount,
    DateTimeOffset EffectiveFrom,
    Guid SetBy,
    DateTimeOffset Now,
    UserContext UserContext,
    Guid CorrelationId,
    decimal? CompareAtAmount = null);
