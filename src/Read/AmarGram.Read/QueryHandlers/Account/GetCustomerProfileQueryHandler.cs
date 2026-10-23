using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-C2. CanEditEmail mirrors the aggregate's own rule (OQ-5): only when a mobile exists.</summary>
public sealed class GetCustomerProfileQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetCustomerProfileQuery, CustomerProfileViewModel?>
{
    public async Task<QueryResponse<CustomerProfileViewModel?>> HandleAsync(GetCustomerProfileQuery query)
    {
        // Two-phase: the DB-translatable phase selects plain scalars; CreatedDate (a platform
        // DateTime, not DateTimeOffset) is converted client-side afterwards.
        var row = await db.CustomerAccounts.AsNoTracking()
            .Where(c => c.Id == query.CustomerId)
            .Select(c => new
            {
                c.FullName,
                MobileNumber = c.MobileNumber == null ? null : c.MobileNumber.Value,
                EmailAddress = c.EmailAddress == null ? null : c.EmailAddress.Value,
                HasMobile = c.MobileNumber != null,
                HasEmail = c.EmailAddress != null,
                c.AdditionalPhoneNumbers,
                c.CreatedDate
            })
            .FirstOrDefaultAsync();

        if (row is null) return new QueryResponse<CustomerProfileViewModel?> { Result = null };

        var viewModel = new CustomerProfileViewModel(
            row.FullName, row.MobileNumber, row.EmailAddress, row.HasMobile, row.HasEmail,
            CanEditEmail: row.HasMobile, row.AdditionalPhoneNumbers,
            new DateTimeOffset(DateTime.SpecifyKind(row.CreatedDate, DateTimeKind.Utc)));

        return new QueryResponse<CustomerProfileViewModel?> { Result = viewModel };
    }
}
