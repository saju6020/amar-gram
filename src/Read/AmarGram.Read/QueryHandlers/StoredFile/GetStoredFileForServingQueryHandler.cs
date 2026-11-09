using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.StoredFile;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.StoredFile;

public sealed class GetStoredFileForServingQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetStoredFileForServingQuery, StoredFileServingInfo?>
{
    public async Task<QueryResponse<StoredFileServingInfo?>> HandleAsync(GetStoredFileForServingQuery query)
    {
        var info = await db.StoredFiles.AsNoTracking()
            .Where(f => f.Id == query.FileId)
            .Select(f => new StoredFileServingInfo(f.StorageKey, f.ContentType, f.OriginalFileName, f.SizeInBytes))
            .FirstOrDefaultAsync();

        return new QueryResponse<StoredFileServingInfo?> { Result = info };
    }
}
