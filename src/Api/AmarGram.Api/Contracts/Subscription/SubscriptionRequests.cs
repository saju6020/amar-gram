namespace AmarGram.Api.Contracts.Subscription;

// HO-SUB-001 §12.4. JSON camelCase; local dates yyyy-MM-dd. Enumeration-typed fields travel as their display names and are parsed by the controller (a bad value is a 400).
// Nothing here is a token, card, mandate or gateway reference (ADR-238).

public sealed class CreateSubscriptionRequest
{
    public required Guid SkuId { get; init; }
    public required int Quantity { get; init; }
    public required int IntervalWeeks { get; init; }
    public DateOnly? FirstDeliveryOn { get; init; }
    public string? Fulfilment { get; init; }
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
    public string? PaymentMethod { get; init; }
}

public sealed class ChangeSubscriptionTermsRequest
{
    public required int Version { get; init; }
    public required int Quantity { get; init; }
    public required int IntervalWeeks { get; init; }
    public string? Fulfilment { get; init; }
    public Guid? DeliveryAddressId { get; init; }
    public Guid? PickupBranchId { get; init; }
    public string? PaymentMethod { get; init; }
}

public sealed class SkipSubscriptionRequest
{
    public required DateOnly CycleOn { get; init; }
}

public sealed class ResumeSubscriptionRequest
{
    public DateOnly? FirstDeliveryOn { get; init; }
}

public sealed class CancelSubscriptionRequest
{
    public string? Reason { get; init; }
    public string? Note { get; init; }
}

public sealed class StaffCancelSubscriptionRequest
{
    public string? Note { get; init; }
}

public sealed class ReinstateSubscriptionRequest
{
    public string? Reason { get; init; }
    public DateOnly? FirstDeliveryOn { get; init; }
}
