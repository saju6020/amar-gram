namespace AmarGram.Api.Contracts.Administration;

public sealed class CreateTaxClassRequest
{
    public string Code { get; init; } = default!;
    public string Name { get; init; } = default!;
}

public sealed class UpdateTaxClassRequest
{
    public string Name { get; init; } = default!;
    public bool IsActive { get; init; }
}

public sealed class SetTaxRateRequest
{
    public decimal RatePercent { get; init; }
    public DateTimeOffset EffectiveFrom { get; init; }
}

public sealed class SettingChangeRequest
{
    public string Key { get; init; } = default!;
    public string Value { get; init; } = default!;
}

public sealed class ChangeSettingsRequest
{
    public IReadOnlyList<SettingChangeRequest> Changes { get; init; } = [];
}
