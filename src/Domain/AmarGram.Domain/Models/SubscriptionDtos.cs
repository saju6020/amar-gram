using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-SUB-001 §11.3 -- everything <c>SubscriptionAggregate.Create</c> needs. The snapshot name and label come from the catalogue lookup, never the client.</summary>
public sealed record CreateSubscriptionDto(
    Guid CustomerId,
    Guid SkuId,
    string ProductName,
    string VariantLabel,
    SubscriptionTerms Terms,
    DateOnly? FirstDeliveryOn,
    SubscriptionClock Clock,
    UserContext UserContext,
    Guid CorrelationId);

/// <summary>HO-SUB-001 §11.3 -- what a customer-facing change answers with: whether it applied now, from which cycle, and the plain-language sentence (US-SUB-02 AC2).</summary>
public sealed record SubscriptionChangeOutcome(bool AppliedImmediately, DateOnly? AppliesFromCycleOn, string Message);

/// <summary>HO-SUB-001 §11.3, §8.7 -- an order was raised for the cycle.</summary>
public sealed record CycleGeneratedDto(
    Guid CycleId,
    Guid SubscriptionId,
    Guid CustomerId,
    DateOnly CycleOn,
    Guid SkuId,
    int Quantity,
    SubscriptionFulfilment Fulfilment,
    SubscriptionPaymentMethod PaymentMethod,
    decimal DiscountPercent,
    string IdempotencyKey,
    Guid OrderId,
    string OrderNumber,
    SubscriptionCycleOrderState OrderState,
    DateTimeOffset? PaymentExpiresOn,
    DateTimeOffset ProcessedOn,
    UserContext UserContext,
    Guid CorrelationId);

/// <summary>HO-SUB-001 §11.3, §8.7 -- the cycle failed: no order was raised. <c>FailureCode</c> is Orders' raw code, kept for support.</summary>
public sealed record CycleFailedDto(
    Guid CycleId,
    Guid SubscriptionId,
    Guid CustomerId,
    DateOnly CycleOn,
    Guid SkuId,
    int Quantity,
    SubscriptionFulfilment Fulfilment,
    SubscriptionPaymentMethod PaymentMethod,
    decimal DiscountPercent,
    string IdempotencyKey,
    SubscriptionCycleFailureReason Reason,
    string? FailureCode,
    DateTimeOffset ProcessedOn,
    UserContext UserContext,
    Guid CorrelationId);

/// <summary>HO-SUB-001 §11.3 -- what the worker hands to the order placement for one due cycle.</summary>
public sealed record SubscriptionOrderRequest(
    Guid SubscriptionId,
    Guid CustomerId,
    Guid SkuId,
    DateOnly CycleOn,
    int Quantity,
    SubscriptionFulfilment Fulfilment,
    Guid? DeliveryAddressId,
    Guid? PickupBranchId,
    SubscriptionPaymentMethod PaymentMethod,
    decimal DiscountPercent,
    string IdempotencyKey);
