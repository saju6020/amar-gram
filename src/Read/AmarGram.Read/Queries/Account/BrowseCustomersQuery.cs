using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Account;

/// <summary>HO-P4 BG-19 -- GET /api/staff/customers/browse. A paged list of active customers for the staff Customers screen; the exact
/// mobile/email lookup (<see cref="FindCustomersQuery"/>) stays as it was.</summary>
public sealed class BrowseCustomersQuery : Query<PagedResult<StaffCustomerListItemViewModel>>
{
    /// <summary>Name contains, email contains (a term with '@'), or mobile contains (a term with three or more digits). Case-insensitive.</summary>
    public string? Search { get; init; }

    /// <summary>One tag, matched exactly as staff typed it.</summary>
    public string? Tag { get; init; }

    /// <summary><c>recent</c> (newest first, the default) or <c>name</c>.</summary>
    public string Sort { get; init; } = CustomerListSorts.Recent;
}

public static class CustomerListSorts
{
    public const string Recent = "recent";
    public const string Name = "name";

    public static bool IsKnown(string? sort) => sort is null || sort == Recent || sort == Name;
}

/// <summary>HO-P4 BG-19 -- GET /api/staff/customers/{id}/notes.</summary>
public sealed class GetCustomerNotesQuery : Query<IReadOnlyList<CustomerNoteViewModel>>
{
    public required Guid CustomerId { get; init; }
}
