using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Ordering;

/// <summary>HO-ORD-001 §8.3 -- <c>nextval</c> through the scoped context. Taken before the order is built so the number can travel in the confirmation
/// message; a placement that then fails simply never uses it (a gap, V1).</summary>
public sealed class OrderNumberGenerator(AmarGramDbContext db) : IOrderNumberGenerator
{
    public async Task<string> NextAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        var next = await db.Database.SqlQueryRaw<long>($"SELECT nextval('{OrderingMigrationSql.OrderNumberSequence}') AS \"Value\"").SingleAsync(ct);
        return OrderRules.FormatOrderNumber(now.UtcDateTime.Year, next);
    }
}
