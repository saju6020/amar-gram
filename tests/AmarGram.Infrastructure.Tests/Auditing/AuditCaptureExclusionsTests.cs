using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Infrastructure.Auditing;
using Xunit;

namespace AmarGram.Infrastructure.Tests.Auditing;

/// <summary>HO-NTF-001 §15, U-X2 / ADR-066.</summary>
public sealed class AuditCaptureExclusionsTests
{
    [Fact]
    public void ContainsExactlyTheAuditRootTheTwoNotifyRootsTheOperationsLogsAndTheInventoryEntryRoots()
    {
        Assert.Equal(8, AuditCaptureExclusions.Types.Count);
        Assert.Contains(typeof(AmarGram.Domain.Aggregates.Operations.WebVitalBatchAggregate), AuditCaptureExclusions.Types);
        // HO-XCT-001 section 5.3 / ADR-303 appended RetentionRunAggregate (its summary BusinessEvent row replaces the DataChange rows).
        Assert.Contains(typeof(AmarGram.Domain.Aggregates.Operations.RetentionRunAggregate), AuditCaptureExclusions.Types);
        Assert.Contains(typeof(AuditEntryAggregate), AuditCaptureExclusions.Types);
        Assert.Contains(typeof(NotificationRequestAggregate), AuditCaptureExclusions.Types);
        Assert.Contains(typeof(NotificationAggregate), AuditCaptureExclusions.Types);
        // HO-P4 BG-19: staff notes are free text about a customer, audited by BusinessEvent rows only.
        Assert.Contains(typeof(AmarGram.Domain.Aggregates.Account.CustomerStaffRecordAggregate), AuditCaptureExclusions.Types);
        // HO-IMP-001 ADR-098: each ledger row already records who, what, when and why, so it is not audited a second time.
        Assert.Contains(typeof(StockLedgerEntryAggregate), AuditCaptureExclusions.Types);
        Assert.Contains(typeof(StockReservationEntryAggregate), AuditCaptureExclusions.Types);
    }

    [Fact]
    public void InventoryBatchesAndOtherRoots_AreAuditedNormally()
    {
        Assert.DoesNotContain(typeof(BatchAggregate), AuditCaptureExclusions.Types);
        Assert.DoesNotContain(typeof(GoodsReceiptAggregate), AuditCaptureExclusions.Types);
    }

    [Fact]
    public void NotificationTemplateAggregate_IsNotExcluded_TemplateEditsAreAuditedNormally()
    {
        Assert.DoesNotContain(typeof(NotificationTemplateAggregate), AuditCaptureExclusions.Types);
    }
}
