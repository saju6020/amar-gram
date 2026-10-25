using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Notifications.Guards;

/// <summary>
/// HO-SUB-001 §8.9 (ADR-246) -- a payment reminder is valid while the cycle (<c>SubjectId</c>) is still mirrored <c>AwaitingPayment</c> and belongs to the
/// recipient. A transfer confirmed in the meantime fails the guard: the customer is never chased for money they have paid. Reads only.
/// </summary>
public sealed class SubscriptionPaymentDueGuard(AmarGramDbContext db) : INotificationSubjectGuard
{
    public NotificationSubjectKind Kind => NotificationSubjectKind.SubscriptionOrderAwaitingPayment;

    public async Task<bool> IsStillValidAsync(Guid recipientId, Guid? subjectId, Guid? subjectRef, DateOnly? subjectDueOn, string? subjectStamp = null, CancellationToken ct = default)
    {
        if (subjectId is null) return false;

        return await db.SubscriptionCycles.AsNoTracking().AnyAsync(
            c => c.Id == subjectId && c.CustomerId == recipientId && c.OrderState == SubscriptionCycleOrderState.AwaitingPayment, ct);
    }
}
