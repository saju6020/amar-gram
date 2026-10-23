using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Account;

/// <summary>Q-F1 -- GET /api/staff-roles.</summary>
public sealed class GetStaffRoleCatalogueQuery : Query<StaffRoleCatalogueViewModel>;
