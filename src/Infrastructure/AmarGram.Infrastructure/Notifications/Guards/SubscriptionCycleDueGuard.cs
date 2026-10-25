using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Notifications.Guards;

/// <summary>
/// HO-SUB-001 §8.8 (ADR-245) -- a pre-charge notice is valid while the subscription exists, is <c>Active</c>, belongs to the recipient, and its next delivery is
/// still the date the notice was about. A skip, pause, cancellation, suspension or interval change between enqueue and send fails the guard
/// (<c>Cancelled SubjectNoLongerApplies</c>), so a customer is never offered a skip link for a delivery that has moved. Reads only.
/// </summary>
public sealed class SubscriptionCycleDueGuard(AmarGramDbContext db) : INotificationSubjectGuard
{
    public NotificationSubjectKind Kind => NotificationSubjectKind.SubscriptionCycleDue;

    public async Task<bool> IsStillValidAsync(Guid recipientId, Guid? subjectId, Guid? subjectRef, DateOnly? subjectDueOn, string? subjectStamp = null, CancellationToken ct = default)
    {
        if (subjectId is null || subjectDueOn is null) return false;

        return await db.Subscriptions.AsNoTracking().AnyAsync(
            s => s.Id == subjectId && s.CustomerId == recipientId && s.Status == SubscriptionStatus.Active && s.NextDeliveryOn == subjectDueOn, ct);
    }
}
