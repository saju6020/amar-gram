namespace CatEcommerce.Domain.Models;

/// <summary>
/// The recall stamp -- HO-IMP-001 §8.7/§8.8 (ADR-104, README C-3). Every consuming kind's
/// requirement is checked by the port, not here: <c>Sale</c> requires <c>CustomerId</c> unless the
/// reference is <c>PosSale</c>.
/// </summary>
public sealed record StockParty(Guid? CustomerId);
