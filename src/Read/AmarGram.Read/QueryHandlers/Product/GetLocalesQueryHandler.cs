using AmarGram.Domain.DomainServices;
using AmarGram.Read.Queries.Product;
using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Product;

/// <summary>HO-SHP-001 section 12.4 -- <c>{ defaultLocale, locales[] }</c> from configuration.</summary>
public sealed class GetLocalesQueryHandler(IContentLocaleSettings localeSettings) : IQueryHandlerAsync<GetLocalesQuery, LocalesViewModel>
{
    public Task<QueryResponse<LocalesViewModel>> HandleAsync(GetLocalesQuery query) =>
        Task.FromResult(new QueryResponse<LocalesViewModel> { Result = new LocalesViewModel(localeSettings.DefaultLocale, localeSettings.EnabledLocales) });
}
