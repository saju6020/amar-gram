using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Administration;

public sealed class GetTaxClassesQuery : Query<IReadOnlyList<TaxClassViewModel>>;

public sealed class GetTaxRatesQuery : Query<IReadOnlyList<TaxRateViewModel>>
{
    public required Guid TaxClassId { get; init; }
}

public sealed class GetSettingsQuery : Query<IReadOnlyList<SettingViewModel>>
{
    public Guid? BranchId { get; init; }
}
