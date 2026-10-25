using AmarGram.Domain.Aggregates.Subscription;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Persistence;

/// <summary>Subscriptions (HO-SUB-001) DbSets -- one partial per area (ADR-341). The model is discovered from the configurations; these are the typed entry points.</summary>
public sealed partial class AmarGramDbContext
{
    public DbSet<SubscriptionAggregate> Subscriptions => Set<SubscriptionAggregate>();
    public DbSet<SubscriptionCycleAggregate> SubscriptionCycles => Set<SubscriptionCycleAggregate>();
}
