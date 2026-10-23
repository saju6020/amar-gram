using AmarGram.Domain.Aggregates.Inventory;

namespace AmarGram.Domain.DomainServices;

/// <summary>
/// HO-IMP-001 §8.14 / ADR-105 -- enlists a NEW batch in the scoped unit of work WITHOUT saving, so the goods receipt's own save
/// commits the receipt, its batches and their ledger entries together. Receipts only.
/// </summary>
public interface IBatchRegistry
{
    void Enlist(BatchAggregate batch);
}
