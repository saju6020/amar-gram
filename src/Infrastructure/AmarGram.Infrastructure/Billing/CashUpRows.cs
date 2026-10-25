using AmarGram.Domain.Aggregates.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Billing;

/// <summary>
/// HO-BIL-001 section 8.10 -- the rows of one branch's business day, the single query both the cash-up read and the close use (so the
/// number the cashier saw is the number frozen). A payment belongs to the date it was <b>accepted</b>; a refund and a reversal to the
/// date they were issued. <b>Late items</b> -- accepted, refunded or reversed after the cash-up of their date was closed -- are carried
/// into the next cash-up at the branch, exactly once (ADR-188).
/// </summary>
public static class CashUpRows
{
    /// <summary>How far back a closed day is searched for late items.</summary>
    public const int LateItemWindowDays = 60;

    public static async Task<IReadOnlyList<CashUpRow>> LoadAsync(AmarGramDbContext db, Guid branchId, DateOnly date, CancellationToken ct = default)
    {
        var rows = new List<CashUpRow>();

        var payments = await db.Set<PaymentAggregate>().AsNoTracking()
            .Where(p => p.BranchId == branchId && p.BusinessDate == date && p.AcceptedOn != null)
            .Select(p => new { p.Id, p.Method, p.Collector, p.Amount, p.ReceiptNumber })
            .ToListAsync(ct);
        rows.AddRange(payments.Select(p => new CashUpRow(p.Id, CashUpRowKind.Payment, p.Method, p.Collector?.Kind, null, p.Amount, false, Receipt(p.ReceiptNumber), SourceOf(p.Collector))));

        var refunds = await db.Set<RefundAggregate>().AsNoTracking()
            .Where(r => r.BranchId == branchId && r.BusinessDate == date)
            .Select(r => new { r.Id, r.Method, r.Amount, r.Reference })
            .ToListAsync(ct);
        rows.AddRange(refunds.Select(r => new CashUpRow(r.Id, CashUpRowKind.Refund, null, null, r.Method, r.Amount, false, r.Reference ?? "Refund")));

        var reversals = await db.Set<PaymentAggregate>().AsNoTracking()
            .Where(p => p.BranchId == branchId && p.ReversalBusinessDate == date)
            .Select(p => new { p.Id, p.Method, p.Collector, p.Amount, p.ReceiptNumber })
            .ToListAsync(ct);
        rows.AddRange(reversals.Select(p => new CashUpRow(p.Id, CashUpRowKind.Reversal, p.Method, p.Collector?.Kind, null, p.Amount, false, Receipt(p.ReceiptNumber), SourceOf(p.Collector))));

        rows.AddRange(await LateItemsAsync(db, branchId, date, ct));
        return await LabelStaffSourcesAsync(db, rows, ct);
    }

    /// <summary>HO-P4 BG-20. A staff-collected cash-on-delivery payment is its own cash source (the collector holds that cash until it is
    /// banked); everything else that moves cash is the till. Only the key here -- the label needs the staff name, see <see cref="LabelStaffSourcesAsync"/>.</summary>
    private static string? SourceOf(AmarGram.Domain.ValueObjects.PaymentCollector? collector) =>
        collector is { StaffAccountId: { } staffId } && collector.Kind == CollectorKind.Staff ? CashUpSources.StaffKey(staffId) : null;

    private static async Task<IReadOnlyList<CashUpRow>> LabelStaffSourcesAsync(AmarGramDbContext db, List<CashUpRow> rows, CancellationToken ct)
    {
        var staffIds = rows.Select(r => CashUpSources.TryParseStaffKey(r.SourceKey, out var id) ? id : (Guid?)null).Where(id => id is not null).Select(id => id!.Value).Distinct().ToList();
        if (staffIds.Count == 0) return rows;

        var names = await db.Set<AmarGram.Domain.Aggregates.Account.StaffAccountAggregate>().AsNoTracking()
            .Where(s => staffIds.Contains(s.Id))
            .Select(s => new { s.Id, s.FullName })
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);

        return rows.Select(r => CashUpSources.TryParseStaffKey(r.SourceKey, out var id)
            ? r with { SourceLabel = names.GetValueOrDefault(id, "Staff collector") }
            : r).ToList();
    }

    /// <summary>Pending payments the day cannot be closed over: received that day, or recorded that day in branch time.</summary>
    public static async Task<int> CountPendingApprovalsAsync(AmarGramDbContext db, Guid branchId, DateOnly date, string timeZoneId, CancellationToken ct = default)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var startLocal = date.ToDateTime(TimeOnly.MinValue);
        var start = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(startLocal, zone), TimeSpan.Zero);
        var end = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(startLocal.AddDays(1), zone), TimeSpan.Zero);

        return await db.Set<PaymentAggregate>().AsNoTracking().CountAsync(
            p => p.BranchId == branchId && p.Status == PaymentStatus.PendingApproval && (p.ReceivedOn == date || (p.RecordedOn >= start && p.RecordedOn < end)), ct);
    }

    private static async Task<IReadOnlyList<CashUpRow>> LateItemsAsync(AmarGramDbContext db, Guid branchId, DateOnly date, CancellationToken ct)
    {
        var floor = date.AddDays(-LateItemWindowDays);
        var closed = await db.Set<CashUpAggregate>().AsNoTracking()
            .Where(c => c.BranchId == branchId && c.Status == CashUpStatus.Closed && c.BusinessDate < date && c.BusinessDate >= floor)
            .Select(c => new { c.BusinessDate, ClosedOn = c.ClosedOn!.Value })
            .ToListAsync(ct);
        if (closed.Count == 0) return [];

        var closedOn = closed.ToDictionary(c => c.BusinessDate, c => c.ClosedOn);
        var dates = closedOn.Keys.ToList();

        // An item is still unclaimed when no closed day between its own date and this one was closed after it arrived.
        bool Unclaimed(DateOnly itemDate, DateTimeOffset arrivedOn) =>
            arrivedOn > closedOn[itemDate] && !closed.Any(other => other.BusinessDate > itemDate && other.BusinessDate < date && other.ClosedOn >= arrivedOn);

        var rows = new List<CashUpRow>();

        var payments = await db.Set<PaymentAggregate>().AsNoTracking()
            .Where(p => p.BranchId == branchId && p.BusinessDate != null && dates.Contains(p.BusinessDate.Value) && p.AcceptedOn != null)
            .Select(p => new { p.Id, p.Method, p.Collector, p.Amount, p.ReceiptNumber, p.BusinessDate, p.AcceptedOn })
            .ToListAsync(ct);
        rows.AddRange(payments.Where(p => Unclaimed(p.BusinessDate!.Value, p.AcceptedOn!.Value))
            .Select(p => new CashUpRow(p.Id, CashUpRowKind.Payment, p.Method, p.Collector?.Kind, null, p.Amount, true, Receipt(p.ReceiptNumber), SourceOf(p.Collector))));

        var refunds = await db.Set<RefundAggregate>().AsNoTracking()
            .Where(r => r.BranchId == branchId && dates.Contains(r.BusinessDate))
            .Select(r => new { r.Id, r.Method, r.Amount, r.Reference, r.BusinessDate, r.IssuedOn })
            .ToListAsync(ct);
        rows.AddRange(refunds.Where(r => Unclaimed(r.BusinessDate, r.IssuedOn))
            .Select(r => new CashUpRow(r.Id, CashUpRowKind.Refund, null, null, r.Method, r.Amount, true, r.Reference ?? "Refund")));

        var reversals = await db.Set<PaymentAggregate>().AsNoTracking()
            .Where(p => p.BranchId == branchId && p.ReversalBusinessDate != null && dates.Contains(p.ReversalBusinessDate.Value) && p.ReversedOn != null)
            .Select(p => new { p.Id, p.Method, p.Collector, p.Amount, p.ReceiptNumber, p.ReversalBusinessDate, p.ReversedOn })
            .ToListAsync(ct);
        rows.AddRange(reversals.Where(p => Unclaimed(p.ReversalBusinessDate!.Value, p.ReversedOn!.Value))
            .Select(p => new CashUpRow(p.Id, CashUpRowKind.Reversal, p.Method, p.Collector?.Kind, null, p.Amount, true, Receipt(p.ReceiptNumber), SourceOf(p.Collector))));

        return rows;
    }

    private static string? Receipt(long? number) => number is { } n ? BillingMessages.ReceiptNumber(n) : null;
}
