using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-H1. One customer, read for staff (`.ai/read-side-pattern.md` §5). HO-P4 BG-19 adds the profile summary (customer since, area, order
/// count, lifetime spend) and the staff tags.</summary>
public sealed class GetStaffCustomerQueryHandler(AmarGramDbContext db, IBusinessSettings settings)
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
                c.RegistrationChannel, c.Status, c.MergedIntoCustomerId, c.CreatedDate
            })
            .FirstOrDefaultAsync();

        if (row is null) return new QueryResponse<StaffCustomerViewModel?> { Result = null };

        // Orders that count: everything the customer placed and did not cancel. Spend is what was actually received net of refunds.
        var orders = await db.Set<OrderAggregate>().AsNoTracking()
            .Where(o => o.CustomerId == row.Id && o.Status != OrderStatus.Cancelled)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Spent = g.Sum(o => o.AmountPaid - o.AmountRefunded) })
            .FirstOrDefaultAsync();

        var area = (await CustomerAreas.LoadAsync(db, [row.Id])).GetValueOrDefault(row.Id);
        var staffRecord = await db.Set<CustomerStaffRecordAggregate>().AsNoTracking()
            .Where(r => r.Id == row.Id)
            .Select(r => new { r.Labels, NoteCount = r.Notes.Count })
            .FirstOrDefaultAsync();

        var viewModel = new StaffCustomerViewModel(
            row.Id, row.FullName, row.MobileNumber, row.EmailAddress,
            CustomerRecordStatusRules.Derive(row.HasPassword).DisplayName,
            row.RegistrationChannel.DisplayName, row.Status.DisplayName, row.MergedIntoCustomerId,
            new DateTimeOffset(DateTime.SpecifyKind(row.CreatedDate, DateTimeKind.Utc)), area,
            orders?.Count ?? 0, BillingMoney.Of(orders?.Spent ?? 0m, settings.GetString(SettingKeys.CommerceCurrencyCode)),
            staffRecord?.Labels.ToList() ?? [], staffRecord?.NoteCount ?? 0);

        return new QueryResponse<StaffCustomerViewModel?> { Result = viewModel };
    }
}

/// <summary>HO-P4 BG-19. A customer's staff notes, newest first, with the author's name as it is now. An unknown customer and a customer with
/// no notes both read as an empty list; an anonymised customer's notes were cleared with the account.</summary>
public sealed class GetCustomerNotesQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetCustomerNotesQuery, IReadOnlyList<CustomerNoteViewModel>>
{
    public async Task<QueryResponse<IReadOnlyList<CustomerNoteViewModel>>> HandleAsync(GetCustomerNotesQuery query)
    {
        var notes = await db.Set<CustomerStaffRecordAggregate>().AsNoTracking()
            .Where(r => r.Id == query.CustomerId)
            .SelectMany(r => r.Notes)
            .Select(n => new { n.Id, n.Text, n.AuthorStaffId, n.CreatedOn })
            .ToListAsync();

        var authorIds = notes.Select(n => n.AuthorStaffId).Distinct().ToList();
        var names = await db.StaffAccounts.AsNoTracking()
            .Where(s => authorIds.Contains(s.Id))
            .Select(s => new { s.Id, s.FullName })
            .ToDictionaryAsync(s => s.Id, s => s.FullName);

        IReadOnlyList<CustomerNoteViewModel> result = notes
            .OrderByDescending(n => n.CreatedOn).ThenBy(n => n.Id)
            .Select(n => new CustomerNoteViewModel(n.Id, n.Text, n.AuthorStaffId, names.GetValueOrDefault(n.AuthorStaffId), n.CreatedOn))
            .ToList();

        return new QueryResponse<IReadOnlyList<CustomerNoteViewModel>> { Result = result };
    }
}
