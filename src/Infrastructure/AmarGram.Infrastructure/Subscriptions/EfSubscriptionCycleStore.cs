using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Infrastructure.Subscriptions;

/// <summary>HO-SUB-001 §11.4 C8. See <see cref="ISubscriptionCycleStore"/>.</summary>
public sealed class EfSubscriptionCycleStore(IAggregateRootRepository<SubscriptionCycleAggregate> repository) : ISubscriptionCycleStore
{
    public async Task<bool> TrySaveAsync(SubscriptionCycleAggregate cycle, CancellationToken ct = default)
    {
        try
        {
            await repository.SaveAsync(cycle, EventPublishOption.InMemoryPublishOnly);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "ix_subscription_cycle_per_date"
        })
        {
            return false;
        }
    }
}
