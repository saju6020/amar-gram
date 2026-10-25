using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Subscription;

// HO-SUB-001 §11.5. Ids, dates, instants, enumeration values, integers and booleans only -- never a note, a reason text, a product name or an address
// (pinned by a reflection test: no string property). Enumeration values travel as their int Value. Nothing inside this slice subscribes to them: they
// exist for HO-RPT-001's subscription-health report and for audit.

public sealed class SubscriptionCreatedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required Guid CustomerId { get; init; }
    public required Guid SkuId { get; init; }
    public required int IntervalWeeks { get; init; }
    public required int Quantity { get; init; }
    public required int PaymentMethod { get; init; }
    public required DateOnly NextDeliveryOn { get; init; }
}

public sealed class SubscriptionTermsChangedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required bool AppliedImmediately { get; init; }
    public DateOnly? AppliesFromCycleOn { get; init; }
}

public sealed class SubscriptionChangeScheduledEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required int Kind { get; init; }
    public DateOnly? AppliesFromCycleOn { get; init; }
}

public sealed class SubscriptionDeliverySkippedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required DateOnly CycleOn { get; init; }
    public required bool AppliedImmediately { get; init; }
}

public sealed class SubscriptionPausedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
}

public sealed class SubscriptionResumedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required int Trigger { get; init; }
    public DateOnly? NextDeliveryOn { get; init; }
}

public sealed class SubscriptionCancelledEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required int Reason { get; init; }
}

public sealed class SubscriptionPendingChangesWithdrawnEvent : Event
{
    public required Guid SubscriptionId { get; init; }
}

public sealed class SubscriptionCycleProcessedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required DateOnly CycleOn { get; init; }
    public required int Outcome { get; init; }
}

public sealed class SubscriptionSuspendedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required int Reason { get; init; }
}

public sealed class SubscriptionReinstatedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public DateOnly? NextDeliveryOn { get; init; }
}

public sealed class SubscriptionCustomerReassignedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required Guid FromCustomerId { get; init; }
    public required Guid ToCustomerId { get; init; }
}

public sealed class SubscriptionOrderGeneratedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required Guid CycleId { get; init; }
    public required Guid OrderId { get; init; }
}

public sealed class SubscriptionCycleFailedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required Guid CycleId { get; init; }
    public required int Reason { get; init; }
}

public sealed class SubscriptionCycleOrderStateChangedEvent : Event
{
    public required Guid SubscriptionId { get; init; }
    public required Guid CycleId { get; init; }
    public required int State { get; init; }
}
