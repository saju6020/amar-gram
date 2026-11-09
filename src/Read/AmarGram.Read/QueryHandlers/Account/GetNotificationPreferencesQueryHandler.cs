using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-E2. Every channel x category cell, so the client never hardcodes which are locked.
/// HO-NTF-001 §12.4 amendment: the three preferred-channel fields.</summary>
public sealed class GetNotificationPreferencesQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetNotificationPreferencesQuery, NotificationPreferencesViewModel>
{
    public async Task<QueryResponse<NotificationPreferencesViewModel>> HandleAsync(GetNotificationPreferencesQuery query)
    {
        var grants = await db.CustomerNotificationPreferences.AsNoTracking()
            .Where(p => p.Id == query.CustomerId)
            .SelectMany(p => p.MarketingConsents)
            .Select(c => new { c.Channel, c.IsGranted })
            .ToListAsync();

        var preferredChannel = await db.CustomerNotificationPreferences.AsNoTracking()
            .Where(p => p.Id == query.CustomerId)
            .Select(p => (NotificationChannel?)p.PreferredChannel)
            .FirstOrDefaultAsync();

        var customer = await db.CustomerAccounts.AsNoTracking()
            .Where(c => c.Id == query.CustomerId)
            .Select(c => new { HasMobile = c.MobileNumber != null, HasEmail = c.EmailAddress != null })
            .FirstOrDefaultAsync();

        var cells = NotificationPreferenceRules.GetAll()
            .Select(cell =>
            {
                var granted = grants.FirstOrDefault(g => g.Channel == cell.Channel)?.IsGranted
                    ?? NotificationPreferenceRules.DefaultMarketingGranted;

                return new NotificationPreferenceCellViewModel(
                    cell.Channel.DisplayName, cell.Category.DisplayName,
                    IsGranted: NotificationPreferenceRules.Permits(cell.Channel, cell.Category, granted),
                    IsEditable: NotificationPreferenceRules.IsEditable(cell.Category),
                    IsAlwaysOn: NotificationPreferenceRules.IsAlwaysOn(cell.Category));
            })
            .ToList();

        var availableChannels = new List<string>();
        if (customer?.HasMobile == true) availableChannels.Add(NotificationChannel.Sms.DisplayName);
        if (customer?.HasEmail == true) availableChannels.Add(NotificationChannel.Email.DisplayName);

        var effectiveChannel = preferredChannel ?? (customer?.HasMobile == true ? NotificationChannel.Sms : NotificationChannel.Email);

        return new QueryResponse<NotificationPreferencesViewModel>
        {
            Result = new NotificationPreferencesViewModel(cells, preferredChannel?.DisplayName, effectiveChannel.DisplayName, availableChannels)
        };
    }
}
