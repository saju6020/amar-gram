using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.ValueObjects;

public sealed record Weight
{
    public const decimal MinKilograms = 0.10m;
    public const decimal MaxKilograms = 30.00m;

    public decimal Kilograms { get; }

    private Weight(decimal kilograms) => Kilograms = kilograms;

    public static Weight Create(decimal kilograms)
    {
        if (kilograms < MinKilograms || kilograms > MaxKilograms)
            throw new DomainRuleViolationException(
                BusinessViolationCodes.InvalidWeight,
                $"Weight must be between {MinKilograms} and {MaxKilograms} kg.",
                nameof(Kilograms));

        return new Weight(kilograms);
    }
}
