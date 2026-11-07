using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Subscription;

// HO-SUB-001 §11.1. Data only; ids minted by the controller or the worker; ValidateCommand = true everywhere. Enumeration-typed fields are parsed by the controller
// (a bad value is a 400 there), as Ordering's PlaceOrderCommand does.

/// <summary>C1 (US-SUB-01 AC1) -- start a subscription. The caller is the signed-in customer; the response carries the new subscription's id.</summary>
public sealed class CreateSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required Guid SkuId { get; init; }
    public required int Quantity { get; init; }
    public required int IntervalWeeks { get; init; }
    public DateOnly? FirstDeliveryOn { get; init; }
    public required SubscriptionFulfilment Fulfilment { get; init; }
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
    public required SubscriptionPaymentMethod PaymentMethod { get; init; }
}

/// <summary>C2 (US-SUB-02) -- change quantity, interval, fulfilment or payment method. <c>ExpectedVersion</c> turns a stale screen into a <c>409</c>.</summary>
public sealed class ChangeSubscriptionTermsCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required int ExpectedVersion { get; init; }
    public required int Quantity { get; init; }
    public required int IntervalWeeks { get; init; }
    public required SubscriptionFulfilment Fulfilment { get; init; }
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
    public required SubscriptionPaymentMethod PaymentMethod { get; init; }
}

/// <summary>C3 -- skip the delivery of <see cref="CycleOn"/>. A stale link is refused specifically (<c>CycleNoLongerSkippable</c>).</summary>
public sealed class SkipSubscriptionDeliveryCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required DateOnly CycleOn { get; init; }
}

/// <summary>C4.</summary>
public sealed class PauseSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
}

/// <summary>C5 -- resume a paused subscription, optionally choosing the first date.</summary>
public sealed class ResumeSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public DateOnly? FirstDeliveryOn { get; init; }
}

/// <summary>C6 -- cancel. A customer cancels their own; staff (<see cref="ByStaff"/>, set by the staff controller after the action check) cancel any, with
/// <c>StaffCancelled</c> and a note.</summary>
public sealed class CancelSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required SubscriptionCancellationReason Reason { get; init; }
    public string? Note { get; init; }
    public bool ByStaff { get; init; }
}

/// <summary>C7 -- withdraw every scheduled change (pending terms, skip, pause or cancellation).</summary>
public sealed class WithdrawPendingSubscriptionChangesCommand : Command
{
    public required Guid SubscriptionId { get; init; }
}

/// <summary>
/// C8 (ADR-240, ADR-241) -- the worker records a processed cycle: the cycle row and the advanced subscription in one save. Idempotent. Either
/// <see cref="OrderId"/> is set (the order was raised) or <see cref="FailureCode"/> is (Orders refused).
/// </summary>
public sealed class RecordSubscriptionCycleCommand : Command
{
    public required Guid SubscriptionCycleId { get; init; }
    public required Guid SubscriptionId { get; init; }
    public required DateOnly CycleOn { get; init; }
    public required string IdempotencyKey { get; init; }
    public required decimal DiscountPercent { get; init; }
    public Guid? OrderId { get; init; }
    public string? OrderNumber { get; init; }

    /// <summary>The placed order's status name (<c>PendingPayment</c> or later).</summary>
    public string? OrderStatus { get; init; }
    public DateTimeOffset? PaymentExpiresOn { get; init; }

    /// <summary>The placed order's grand total and currency -- display text for the payment reminder only.</summary>
    public decimal? OrderTotal { get; init; }
    public string? CurrencyCode { get; init; }

    /// <summary>Orders' raw refusal code when no order was raised.</summary>
    public string? FailureCode { get; init; }
}

/// <summary>C9 -- the worker suspends a subscription for unpaid cycles; the handler re-evaluates the rule before suspending (the pass only nominates).</summary>
public sealed class SuspendSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required SubscriptionSuspensionReason Reason { get; init; }
}

/// <summary>C11 -- staff restart a suspended subscription, with a reason.</summary>
public sealed class ReinstateSubscriptionCommand : Command
{
    public required Guid SubscriptionId { get; init; }
    public required string Reason { get; init; }
    public DateOnly? FirstDeliveryOn { get; init; }
}

/// <summary>
/// HO-SUB-001 §8.12 (adapted C-ORD-1) -- the worker asks Ordering's machinery to place one subscription cycle's order, as the system actor, under the cycle's
/// idempotency key. Dispatched in <b>its own scope</b> (ADR-241): never from inside another handler. Success carries a <c>PlaceOrderResult</c>.
/// </summary>
public sealed class PlaceSubscriptionOrderCommand : Command
{
    public required Guid OrderId { get; init; }
    public required Guid SubscriptionId { get; init; }
    public required Guid CustomerId { get; init; }
    public required Guid SkuId { get; init; }
    public required DateOnly CycleOn { get; init; }
    public required int Quantity { get; init; }
    public required SubscriptionFulfilment Fulfilment { get; init; }
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
    public required SubscriptionPaymentMethod PaymentMethod { get; init; }
    public required decimal DiscountPercent { get; init; }
}
