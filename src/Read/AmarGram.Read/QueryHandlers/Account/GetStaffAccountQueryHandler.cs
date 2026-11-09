using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-F3. hasPassword IS included -- an administrator needs to know the holder has not
/// yet set one.</summary>
public sealed class GetStaffAccountQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetStaffAccountQuery, StaffAccountViewModel?>
{
    public async Task<QueryResponse<StaffAccountViewModel?>> HandleAsync(GetStaffAccountQuery query)
    {
        var viewModel = await db.StaffAccounts.AsNoTracking()
            .Where(s => s.Id == query.StaffAccountId)
            .Select(s => new StaffAccountViewModel(
                s.Id, s.FullName,
                s.MobileNumber == null ? null : s.MobileNumber.Value,
                s.EmailAddress == null ? null : s.EmailAddress.Value,
                s.RoleIds, s.PasswordCredential != null))
            .FirstOrDefaultAsync();

        return new QueryResponse<StaffAccountViewModel?> { Result = viewModel };
    }
}
