using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Subscription;

// HO-SUB-001 §12.6. Explicit projections, AsNoTracking; worker queries never write. Every customer query resolves by id AND caller (someone else's is null -> 404).

/// <summary>The caller's subscriptions, newest first. <c>Live</c> true: Active, Paused and Suspended; false: Cancelled; null: all. Paged.</summary>
public sealed class GetCustomerSubscriptionsQuery : Query<PagedResult<SubscriptionViewModel>>
{
    public required Guid CustomerId { get; init; }
    public bool? Live { get; init; }
}

/// <summary>One subscription of the caller's with its latest cycles (null -> <c>404</c>, the same answer as another customer's).</summary>
public sealed class GetCustomerSubscriptionDetailQuery : Query<CustomerSubscriptionDetailViewModel?>
{
    public required Guid CustomerId { get; init; }
    public required Guid SubscriptionId { get; init; }
}

/// <summary>A page of one subscription's cycles, newest first. <c>CustomerId</c> null is the staff read (no ownership check).</summary>
public sealed class GetSubscriptionCyclesQuery : Query<PagedResult<SubscriptionCycleViewModel>?>
{
    public required Guid SubscriptionId { get; init; }
    public Guid? CustomerId { get; init; }
}

/// <summary>What the product page's "Subscribe" needs (§12.4): intervals, limits, the discount, the earliest and latest first delivery, whether this SKU is on offer.</summary>
public sealed class GetSubscriptionOptionsQuery : Query<SubscriptionOptionsViewModel?>
{
    public required Guid CustomerId { get; init; }
    public required Guid SkuId { get; init; }
}

/// <summary>The payment methods Orders would offer this subscription's fulfilment at the estimated value (BR-15 asked of Orders' own rules), limited to the fulfilment's allowed methods.</summary>
public sealed class GetSubscriptionPaymentMethodsQuery : Query<IReadOnlyList<SubscriptionPaymentMethodViewModel>?>
{
    public required Guid CustomerId { get; init; }
    public required Guid SkuId { get; init; }
    public int Quantity { get; init; } = 1;
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
}

/// <summary>Staff list (<c>Subscriptions.View</c>). <c>CustomerId</c> narrows it to one customer's.</summary>
public sealed class GetStaffSubscriptionsQuery : Query<PagedResult<StaffSubscriptionRowViewModel>>
{
    public SubscriptionStatus? Status { get; init; }
    public SubscriptionSuspensionReason? SuspensionReason { get; init; }
    public SubscriptionPaymentMethod? PaymentMethod { get; init; }
    public string? Text { get; init; }
    public string? Sort { get; init; }
    public Guid? CustomerId { get; init; }
    /// <summary>Only <c>Active</c> subscriptions whose next delivery is on this commerce-zone date (the due-tomorrow rule).</summary>
    public DateOnly? NextDeliveryOn { get; init; }
}

/// <summary>US-SUB-06 AC2 -- suspended for unpaid cycles, and at-risk (Active with an unpaid streak of at least one, or a cycle still awaiting payment).</summary>
public sealed class GetUnpaidSubscriptionsQuery : Query<PagedResult<UnpaidSubscriptionViewModel>>
{
}

public sealed class GetStaffSubscriptionDetailQuery : Query<StaffSubscriptionDetailViewModel?>
{
    public required Guid SubscriptionId { get; init; }
}

/// <summary>The customer-page panel: live subscriptions, cancelled and suspended counts (null customer -> not asked).</summary>
public sealed class GetCustomerSubscriptionSummaryQuery : Query<CustomerSubscriptionSummaryViewModel>
{
    public required Guid CustomerId { get; init; }
}

/// <summary>The CSV export (<c>Subscriptions.Export</c>): the staff list's filters, every row up to the cap, no paging.</summary>
public sealed class ExportSubscriptionsQuery : Query<IReadOnlyList<StaffSubscriptionRowViewModel>>
{
    public SubscriptionStatus? Status { get; init; }
    public SubscriptionSuspensionReason? SuspensionReason { get; init; }
    public SubscriptionPaymentMethod? PaymentMethod { get; init; }
    public string? Text { get; init; }
    public string? Sort { get; init; }
    public DateOnly? NextDeliveryOn { get; init; }
}

/// <summary>The dashboard's "Subscription orders due tomorrow" and the subscriptions at a glance.</summary>
public sealed class GetSubscriptionDueTomorrowQuery : Query<SubscriptionDueTomorrowViewModel>
{
}

/// <summary>Worker: <c>Active</c> subscriptions whose unpaid streak (since any reinstatement) has reached the threshold, oldest first, at most <see cref="Take"/>.</summary>
public sealed class GetUnpaidSuspensionCandidatesQuery : Query<IReadOnlyList<Guid>>
{
    public required int Threshold { get; init; }
    public int Take { get; init; } = 200;

    /// <summary>Tests only: restrict the pass to one customer. Null in production.</summary>
    public Guid? CustomerId { get; init; }
}

/// <summary>Worker: <c>Active</c> subscriptions in their notice window whose date was not just chosen by the customer (§8.8), oldest first.</summary>
public sealed class GetPreChargeNoticeCandidatesQuery : Query<IReadOnlyList<PreChargeNoticeCandidate>>
{
    public int Take { get; init; } = 200;

    /// <summary>Tests only: restrict the pass to one customer. Null in production.</summary>
    public Guid? CustomerId { get; init; }
}

/// <summary>Worker: <c>Active</c> subscriptions with <c>NextDeliveryOn</c> on or before today, oldest first, at most <see cref="Take"/> (ADR-249).</summary>
public sealed class GetDueSubscriptionCyclesQuery : Query<IReadOnlyList<DueSubscriptionCycle>>
{
    public int Take { get; init; } = 200;

    /// <summary>Tests only: restrict the pass to one customer so a test's clock never generates another test's orders in the shared database. Null in production.</summary>
    public Guid? CustomerId { get; init; }
}

/// <summary>Worker: what the generation pass hands to order placement for one due cycle (null when the subscription is no longer due -- the pass skips it).</summary>
public sealed class GetSubscriptionOrderRequestQuery : Query<AmarGram.Domain.Models.SubscriptionOrderRequest?>
{
    public required Guid SubscriptionId { get; init; }
    public required DateOnly CycleOn { get; init; }
}
