using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-H1. One customer, read for staff (`.ai/read-side-pattern.md` §5).</summary>
public sealed class GetStaffCustomerQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetStaffCustomerQuery, StaffCustomerViewModel?>
{
    public async Task<QueryResponse<StaffCustomerViewModel?>> HandleAsync(GetStaffCustomerQuery query)
    {
        var row = await db.CustomerAccounts.AsNoTracking()
            .Where(c => c.Id == query.CustomerId)
            .Select(c => new
            {
                c.Id, c.FullName,
                MobileNumber = c.MobileNumber == null ? null : c.MobileNumber.Value,
                EmailAddress = c.EmailAddress == null ? null : c.EmailAddress.Value,
                HasPassword = c.PasswordCredential != null,
                c.RegistrationChannel, c.Status, c.MergedIntoCustomerId
            })
            .FirstOrDefaultAsync();

        if (row is null) return new QueryResponse<StaffCustomerViewModel?> { Result = null };

        var viewModel = new StaffCustomerViewModel(
            row.Id, row.FullName, row.MobileNumber, row.EmailAddress,
            CustomerRecordStatusRules.Derive(row.HasPassword).DisplayName,
            row.RegistrationChannel.DisplayName, row.Status.DisplayName, row.MergedIntoCustomerId);

        return new QueryResponse<StaffCustomerViewModel?> { Result = viewModel };
    }
}
