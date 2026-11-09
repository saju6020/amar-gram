using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;

namespace AmarGram.Infrastructure.Inventory;

/// <summary>Adds a NEW alert to the scoped <see cref="AmarGramDbContext"/> <b>without saving</b> (F23). Never call <c>SaveChangesAsync</c> here.</summary>
public sealed class EfInventoryAlertEnlister(AmarGramDbContext db) : IInventoryAlertEnlister
{
    public void Enlist(InventoryAlertAggregate alert) => db.InventoryAlerts.Add(alert);
}
