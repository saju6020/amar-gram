using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Infrastructure.Ordering;

/// <summary>HO-ORD-001 §12.2 -- <see cref="IOrderingStaging"/>: <c>db.Add</c> without saving (the <c>EfNotificationOutbox</c> technique).</summary>
public sealed class OrderingStaging(AmarGramDbContext db) : IOrderingStaging
{
    public void Add<TAggregate>(TAggregate aggregate) where TAggregate : AggregateRoot => db.Add(aggregate);
}
