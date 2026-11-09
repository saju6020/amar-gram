using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace AmarGram.Infrastructure.Ordering;

/// <summary>
/// HO-ORD-001 §12.7 / ADR-202 -- a singleton <see cref="IDbContextFactory{TContext}"/> for the edge infrastructure that must commit <b>on its own</b>
/// (the idempotency claim, the webhook inbox): a fresh <see cref="AmarGramDbContext"/> per call, built from the same connection string as
/// the request-scoped context. It deliberately carries <b>no audit interceptors</b> -- those need the caller's user context and audit aggregate
/// changes, and an idempotency row is neither -- and it is the only way these writes avoid riding on the request's own unit of work.
/// </summary>
public sealed class OpsDbContextFactory(IConfiguration configuration) : IDbContextFactory<AmarGramDbContext>
{
    public AmarGramDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AmarGramDbContext>()
            .UseNpgsql(configuration.GetConnectionString("AmarGram"))
            .Options;

        return new AmarGramDbContext(options);
    }
}
