using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Account;

/// <summary>Q-C2 -- GET /api/customers/me.</summary>
public sealed class GetCustomerProfileQuery : Query<CustomerProfileViewModel?>
{
    public required Guid CustomerId { get; init; }
}
