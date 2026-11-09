using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Account;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Helpers;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Account;

/// <summary>Q-F2. HO-P4 BG-22 adds each row's assigned branches (primary first) and its derived status.</summary>
public sealed class GetStaffAccountsQueryHandler(AmarGramDbContext db, TimeProvider timeProvider)
    : IQueryHandlerAsync<GetStaffAccountsQuery, PagedResult<StaffAccountSummaryViewModel>>
{
    public async Task<QueryResponse<PagedResult<StaffAccountSummaryViewModel>>> HandleAsync(GetStaffAccountsQuery query)
    {
        var filtered = db.StaffAccounts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
            filtered = filtered.Where(s => s.FullName.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.RoleId))
            filtered = filtered.Where(s => s.RoleIds.Contains(query.RoleId));

        var totalCount = await filtered.CountAsync();

        var rows = await filtered
            .OrderBy(s => s.FullName)
            .Skip(query.Skip).Take(query.Take)
            .Select(s => new
            {
                s.Id, s.FullName,
                MobileNumber = s.MobileNumber == null ? null : s.MobileNumber.Value,
                EmailAddress = s.EmailAddress == null ? null : s.EmailAddress.Value,
                s.RoleIds,
                HasPassword = s.PasswordCredential != null,
                LockedUntil = s.LoginThrottle.LockedUntil
            })
            .ToListAsync();

        var branchesByStaff = await LoadBranchesAsync(rows.Select(r => r.Id).ToList());
        var asOf = timeProvider.GetUtcNow();

        var items = rows.Select(r => new StaffAccountSummaryViewModel(
            r.Id, r.FullName, r.MobileNumber, r.EmailAddress, r.RoleIds, r.HasPassword,
            StaffAccountStatusRules.Derive(r.HasPassword, r.LockedUntil, asOf).DisplayName,
            branchesByStaff.GetValueOrDefault(r.Id) ?? [])).ToList();

        return new QueryResponse<PagedResult<StaffAccountSummaryViewModel>>
        {
            Result = new PagedResult<StaffAccountSummaryViewModel>(items, query.PageNumber, query.PageSize, totalCount)
        };
    }

    /// <summary>Two narrow reads for the page only (never one per row): the assignments, then the names of the branches they mention.</summary>
    private async Task<Dictionary<Guid, IReadOnlyList<StaffAccountBranchViewModel>>> LoadBranchesAsync(IReadOnlyList<Guid> staffIds)
    {
        var assignments = await db.Set<StaffBranchAssignmentAggregate>().AsNoTracking()
            .Where(a => staffIds.Contains(a.Id))
            .Select(a => new { a.Id, a.BranchIds, a.PrimaryBranchId })
            .ToListAsync();
        if (assignments.Count == 0) return [];

        var branchIds = assignments.SelectMany(a => a.BranchIds).Distinct().ToList();
        var names = await db.Set<BranchAggregate>().AsNoTracking()
            .Where(b => branchIds.Contains(b.Id))
            .Select(b => new { b.Id, b.Name })
            .ToDictionaryAsync(b => b.Id, b => b.Name);

        return assignments.ToDictionary(
            a => a.Id,
            a => (IReadOnlyList<StaffAccountBranchViewModel>)a.BranchIds
                .Where(names.ContainsKey)
                .Select(id => new StaffAccountBranchViewModel(id, names[id], id == a.PrimaryBranchId))
                .OrderByDescending(b => b.IsPrimary).ThenBy(b => b.Name, StringComparer.OrdinalIgnoreCase)
                .ToList());
    }
}
