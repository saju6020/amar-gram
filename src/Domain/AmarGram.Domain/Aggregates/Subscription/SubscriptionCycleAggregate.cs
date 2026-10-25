using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Subscription;

/// <summary>
/// HO-SUB-001 §8.7 (US-SUB-01 AC2, US-SUB-04, US-SUB-06, ADR-240, ADR-243) -- what happened when one cycle's date arrived: an order was raised (its id, number
/// and the mirrored outcome) or the attempt failed. A weekly-ish subscription accumulates cycles for years, so cycles are their own root
/// (<c>.ai/bounded-contexts.md</c> rule 3); the unpaid streak is <i>derived</i> from them. <c>(SubscriptionId, CycleOn)</c> is unique, which together with the
/// order idempotency key makes a retried or crashed cycle exactly-once in effect (ADR-241).
/// </summary>
public sealed class SubscriptionCycleAggregate : AggregateRoot
{
    public Guid SubscriptionId { get; private set; }
    public Guid CustomerId { get; private set; }
    public DateOnly CycleOn { get; private set; }
    public Guid SkuId { get; private set; }
    public int Quantity { get; private set; }
    public SubscriptionFulfilment Fulfilment { get; private set; } = default!;
    public SubscriptionPaymentMethod PaymentMethod { get; private set; } = default!;

    /// <summary>The discount setting at generation, snapshotted (US-SUB-04, HO-ADM-001 ADR-049).</summary>
    public decimal DiscountPercent { get; private set; }

    public string IdempotencyKey { get; private set; } = default!;
    public SubscriptionCycleOutcome Outcome { get; private set; } = default!;
    public Guid? OrderId { get; private set; }
    public string? OrderNumber { get; private set; }
    public SubscriptionCycleOrderState? OrderState { get; private set; }
    public DateTimeOffset? PaymentExpiresOn { get; private set; }
    public SubscriptionCycleFailureReason? FailureReason { get; private set; }

    /// <summary>Orders' raw refusal code, kept for support.</summary>
    public string? FailureCode { get; private set; }

    public DateTimeOffset ProcessedOn { get; private set; }
    public DateTimeOffset? OrderStateChangedOn { get; private set; }

    private SubscriptionCycleAggregate() { }

    public SubscriptionCycleAggregate(Guid id) : base(id) { }

    /// <summary>Unpaid = the order expired, or the COD parcel was refused (§8.7, OQ-5).</summary>
    public bool IsUnpaid => UnpaidCycleRule.IsUnpaid(OrderState);

    public void RecordGenerated(CycleGeneratedDto dto)
    {
        Fill(dto.SubscriptionId, dto.CustomerId, dto.CycleOn, dto.SkuId, dto.Quantity, dto.Fulfilment, dto.PaymentMethod, dto.DiscountPercent, dto.IdempotencyKey, dto.ProcessedOn);
        Outcome = SubscriptionCycleOutcome.Generated;
        OrderId = dto.OrderId;
        OrderNumber = dto.OrderNumber.Length <= 40 ? dto.OrderNumber : dto.OrderNumber[..40];
        OrderState = dto.OrderState;
        PaymentExpiresOn = dto.PaymentExpiresOn;

        SetDefaultValue(dto.UserContext);
        AddDomainEvent(new SubscriptionOrderGeneratedEvent
        {
            SubscriptionId = SubscriptionId, CycleId = Id, OrderId = dto.OrderId, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext,
        });
        UpdateVersion();
    }

    public void RecordFailed(CycleFailedDto dto)
    {
        Fill(dto.SubscriptionId, dto.CustomerId, dto.CycleOn, dto.SkuId, dto.Quantity, dto.Fulfilment, dto.PaymentMethod, dto.DiscountPercent, dto.IdempotencyKey, dto.ProcessedOn);
        Outcome = SubscriptionCycleOutcome.Failed;
        FailureReason = dto.Reason;
        FailureCode = dto.FailureCode is { Length: > 100 } code ? code[..100] : dto.FailureCode;

        SetDefaultValue(dto.UserContext);
        AddDomainEvent(new SubscriptionCycleFailedEvent
        {
            SubscriptionId = SubscriptionId, CycleId = Id, Reason = dto.Reason.Value, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext,
        });
        UpdateVersion();
    }

    /// <summary>
    /// Mirrors Orders' outcome (ADR-243). Orders is the authority, so the mirror never refuses a fact: a same-state redelivery is a no-op (returns false, no
    /// event, no version bump), a transition the table does not list is ignored (returns false; the caller logs ids at <c>Warning</c>).
    /// </summary>
    public bool RecordOrderState(SubscriptionCycleOrderState state, DateTimeOffset at, UserContext user, Guid correlationId)
    {
        if (Outcome != SubscriptionCycleOutcome.Generated || OrderState == state || !IsAllowed(OrderState!, state)) return false;

        OrderState = state;
        OrderStateChangedOn = at;
        AddDomainEvent(new SubscriptionCycleOrderStateChangedEvent { SubscriptionId = SubscriptionId, CycleId = Id, State = state.Value, CorrelationId = correlationId, UserContext = user });
        UpdateVersion();
        return true;
    }

    /// <summary>Whether <c>from -&gt; to</c> is a move the mirror accepts (§8.7). Public so a handler can tell "ignored" from "redelivered".</summary>
    public static bool IsAllowed(SubscriptionCycleOrderState from, SubscriptionCycleOrderState to) =>
        (from == SubscriptionCycleOrderState.AwaitingPayment && (to == SubscriptionCycleOrderState.Confirmed || to == SubscriptionCycleOrderState.Expired || to == SubscriptionCycleOrderState.Cancelled))
        || (from == SubscriptionCycleOrderState.Confirmed && (to == SubscriptionCycleOrderState.Delivered || to == SubscriptionCycleOrderState.Cancelled || to == SubscriptionCycleOrderState.Refused));

    /// <summary>The customer was merged into another (ADR-039). Idempotent.</summary>
    public bool ReassignCustomer(Guid survivingCustomerId)
    {
        if (CustomerId == survivingCustomerId) return false;

        CustomerId = survivingCustomerId;
        UpdateVersion();
        return true;
    }

    private void Fill(
        Guid subscriptionId, Guid customerId, DateOnly cycleOn, Guid skuId, int quantity, SubscriptionFulfilment fulfilment, SubscriptionPaymentMethod method,
        decimal discountPercent, string key, DateTimeOffset processedOn)
    {
        SubscriptionId = subscriptionId;
        CustomerId = customerId;
        CycleOn = cycleOn;
        SkuId = skuId;
        Quantity = quantity;
        Fulfilment = fulfilment;
        PaymentMethod = method;
        DiscountPercent = discountPercent;
        IdempotencyKey = key;
        ProcessedOn = processedOn;
    }
}
