namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// Owned by HO-NTF-001 §8.7/§10.1 -- what a notification request is about, for the send-time guard.
/// Not a partial type: every later handover that adds a subject kind appends a member directly to
/// this file, each with an Amended row in HO-NTF-001 §1. HO-P1 retired members 1-3, 5, 7-9 and 11;
/// the remaining values are unchanged.
/// </summary>
public sealed class NotificationSubjectKind(int value, string displayName) : Enumeration(value, displayName)
{
    /// <summary>HO-SHP-001 §8.11 -- valid while the stock alert is <c>Notified</c>, its SKU Active and its
    /// product Active and listed (<c>StockAlertGuard</c>). Stock is not re-checked at send time.</summary>
    public static readonly NotificationSubjectKind StockAlert = new(4, nameof(StockAlert));

    /// <summary>HO-IMP-001 §8.12 -- valid while the batch (<c>SubjectId</c>) is <c>Recalled</c> (<c>BatchRecallGuard</c>).</summary>
    public static readonly NotificationSubjectKind BatchRecall = new(6, nameof(BatchRecall));

    public static readonly NotificationSubjectKind ScheduledReport = new(10, nameof(ScheduledReport));

    /// <summary>HO-SUB-001 §8.8 -- valid while the subscription (<c>SubjectId</c>) is Active, the recipient's, and its next delivery is still <c>SubjectDueOn</c> (<c>SubscriptionCycleDueGuard</c>).</summary>
    public static readonly NotificationSubjectKind SubscriptionCycleDue = new(12, nameof(SubscriptionCycleDue));

    /// <summary>HO-SUB-001 §8.9 -- valid while the cycle (<c>SubjectId</c>) is still <c>AwaitingPayment</c> (<c>SubscriptionPaymentDueGuard</c>).</summary>
    public static readonly NotificationSubjectKind SubscriptionOrderAwaitingPayment = new(13, nameof(SubscriptionOrderAwaitingPayment));
}
