using AmarGram.Domain.Aggregates.StoredFile;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Persistence;

/// <summary>File Storage (HO-FIL-001) DbSets. See ADR-341 for the per-area partial pattern.</summary>
public sealed partial class AmarGramDbContext
{
    public DbSet<StoredFileAggregate> StoredFiles => Set<StoredFileAggregate>();
}
