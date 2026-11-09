using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Product;

/// <summary>HO-SHP-001 section 11.1 C6.</summary>
public sealed class ScheduleSkuPriceCommand : Command
{
    public required Guid SkuPriceId { get; init; }
    public required Guid SkuId { get; init; }
    public required decimal Amount { get; init; }
    public required string CurrencyCode { get; init; }
    public required DateTimeOffset EffectiveFrom { get; init; }

    /// <summary>HO-P4 BG-13 -- optional compare-at ("Was") amount, same currency, must exceed <see cref="Amount"/>.</summary>
    public decimal? CompareAtAmount { get; init; }
}
