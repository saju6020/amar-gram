using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Notification;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Notification;

/// <summary>HO-NTF-001 §12.4 -- GET /api/customers/me/inbox/unread-count.</summary>
public sealed class GetInboxUnreadCountQueryHandler(AmarGramDbContext db) : IQueryHandlerAsync<GetInboxUnreadCountQuery, int>
{
    public async Task<QueryResponse<int>> HandleAsync(GetInboxUnreadCountQuery query)
    {
        var count = await db.Set<NotificationAggregate>().AsNoTracking()
            .CountAsync(n => n.RecipientId == query.CustomerId && n.Channel == NotificationChannel.InApp && n.ReadOn == null);

        return new QueryResponse<int> { Result = count };
    }
}
