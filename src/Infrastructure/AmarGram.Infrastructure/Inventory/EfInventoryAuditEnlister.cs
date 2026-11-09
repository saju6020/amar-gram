using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;

namespace AmarGram.Infrastructure.Inventory;

/// <summary>Adds a NEW audit entry to the scoped <see cref="AmarGramDbContext"/> <b>without saving</b>. Never call <c>SaveChangesAsync</c> here.</summary>
public class EfInventoryAuditEnlister(AmarGramDbContext db) : IInventoryAuditEnlister
{
    public virtual void Enlist(AuditEntryAggregate entry) => db.AuditEntries.Add(entry);
}
