using AmarGram.Read.Queries.StoredFile;
using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.StoredFile;

/// <summary>HO-FIL-001 §12 / §8.6. Used by any consuming read that needs a signed URL for one
/// file it already knows the id of (e.g. a future read) -- a consumer that lists several files
/// uses <see cref="IStoredFileSigningBatcher"/> for its whole
/// list in one query instead of dispatching this query once per photo (gate-fix 2026-09-27,
/// ARCHITECTURE MEDIUM). This handler is now a thin wrapper over the same batcher (gate-fix
/// 2026-09-27, ARCHITECTURE LOW second pass) so the metadata-plus-sign mapping is owned in exactly
/// one place.</summary>
public sealed class GetStoredFileQueryHandler(IStoredFileSigningBatcher batcher)
    : IQueryHandlerAsync<GetStoredFileQuery, StoredFileViewModel?>
{
    public async Task<QueryResponse<StoredFileViewModel?>> HandleAsync(GetStoredFileQuery query)
    {
        var signed = await batcher.SignManyAsync([query.FileId], query.RequestedDisposition);
        return new QueryResponse<StoredFileViewModel?> { Result = signed.GetValueOrDefault(query.FileId) };
    }
}
