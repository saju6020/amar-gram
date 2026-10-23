using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;

namespace AmarGram.Infrastructure.Inventory;

/// <summary>
/// HO-IMP-001 §8.14 / ADR-105 -- adds a NEW batch to the scoped <see cref="AmarGramDbContext"/> <b>without saving</b>: the goods receipt's own
/// save commits the receipt, its batches and their ledger entries together (F23). Receipts only. Never call <c>SaveChangesAsync</c> here.
/// </summary>
public sealed class EfBatchRegistry(AmarGramDbContext db) : IBatchRegistry
{
    public void Enlist(BatchAggregate batch) => db.Batches.Add(batch);
}
