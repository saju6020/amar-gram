using AmarGram.Domain.Aggregates.Account;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>
/// HO-P4 BG-19. The browsable customer list. Only <b>active</b> customers are listed: an anonymised record is a placeholder with no
/// personal data and a merged one is a retired duplicate, neither is a customer staff would browse to (both stay reachable by id and by the
/// existing lookup). Area and tags for the page are fetched in one query each, never per row.
/// </summary>
public sealed class BrowseCustomersQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<BrowseCustomersQuery, PagedResult<StaffCustomerListItemViewModel>>
{
    public async Task<QueryResponse<PagedResult<StaffCustomerListItemViewModel>>> HandleAsync(BrowseCustomersQuery query)
    {
        var customers = db.CustomerAccounts.AsNoTracking().Where(c => c.Status == CustomerAccountStatus.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            var pattern = "%" + EscapeLike(term) + "%";
            var digits = new string(term.Where(char.IsDigit).ToArray());

            customers = digits.Length >= 3
                ? customers.Where(c => EF.Functions.ILike(c.FullName, pattern, "\\")
                    || (c.EmailAddress != null && EF.Functions.ILike(c.EmailAddress.Value, pattern, "\\"))
                    || (c.MobileNumber != null && c.MobileNumber.Value.Contains(digits)))
                : customers.Where(c => EF.Functions.ILike(c.FullName, pattern, "\\")
                    || (c.EmailAddress != null && EF.Functions.ILike(c.EmailAddress.Value, pattern, "\\")));
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            var tag = query.Tag.Trim();
            customers = customers.Where(c => db.Set<CustomerStaffRecordAggregate>().Any(r => r.Id == c.Id && r.Labels.Contains(tag)));
        }

        var totalCount = await customers.CountAsync();

        var ordered = query.Sort == CustomerListSorts.Name
            ? customers.OrderBy(c => c.FullName).ThenBy(c => c.Id)
            : customers.OrderByDescending(c => c.CreatedDate).ThenBy(c => c.Id);

        var rows = await ordered.Skip(query.Skip).Take(query.Take)
            .Select(c => new
            {
                c.Id, c.FullName,
                MobileNumber = c.MobileNumber == null ? null : c.MobileNumber.Value,
                EmailAddress = c.EmailAddress == null ? null : c.EmailAddress.Value,
                HasPassword = c.PasswordCredential != null,
                c.Status, c.CreatedDate
            })
            .ToListAsync();

        var ids = rows.Select(r => r.Id).ToList();
        var areas = await CustomerAreas.LoadAsync(db, ids);
        var tags = await db.Set<CustomerStaffRecordAggregate>().AsNoTracking()
            .Where(r => ids.Contains(r.Id))
            .Select(r => new { r.Id, r.Labels })
            .ToDictionaryAsync(r => r.Id, r => (IReadOnlyList<string>)r.Labels.ToList());

        var items = rows.Select(r => new StaffCustomerListItemViewModel(
            r.Id, r.FullName, r.MobileNumber, r.EmailAddress,
            CustomerRecordStatusRules.Derive(r.HasPassword).DisplayName, r.Status.DisplayName,
            new DateTimeOffset(DateTime.SpecifyKind(r.CreatedDate, DateTimeKind.Utc)),
            areas.GetValueOrDefault(r.Id), tags.GetValueOrDefault(r.Id) ?? [])).ToList();

        return new QueryResponse<PagedResult<StaffCustomerListItemViewModel>>
        {
            Result = new PagedResult<StaffCustomerListItemViewModel>(items, query.PageNumber, query.PageSize, totalCount)
        };
    }

    private static string EscapeLike(string value) => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}

/// <summary>HO-P4 BG-19 -- a customer's area: the district of the default delivery address (null when they have none).</summary>
internal static class CustomerAreas
{
    public static async Task<Dictionary<Guid, string>> LoadAsync(AmarGramDbContext db, IReadOnlyCollection<Guid> customerIds)
    {
        if (customerIds.Count == 0) return [];

        var rows = await db.CustomerAddressBooks.AsNoTracking()
            .Where(b => customerIds.Contains(b.Id) && b.DefaultAddressId != null)
            .Select(b => new { b.Id, District = b.Addresses.Where(a => a.Id == b.DefaultAddressId).Select(a => a.District).FirstOrDefault() })
            .ToListAsync();

        return rows.Where(r => r.District is not null).ToDictionary(r => r.Id, r => r.District!);
    }
}
