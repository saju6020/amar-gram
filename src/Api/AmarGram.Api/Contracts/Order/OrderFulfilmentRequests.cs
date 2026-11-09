namespace AmarGram.Api.Contracts.Order;

/// <summary><c>POST /api/staff/orders/{orderId}/dispatch</c>. The tracking number may follow later (<c>PUT …/tracking</c>). HO-P4 BG-5: send <b>exactly one</b> of <c>courierId</c> and
/// <c>riderId</c> (an in-house rider of the active branch; a rider delivery has no tracking number).</summary>
public sealed class DispatchOrderRequest
{
    public Guid? CourierId { get; init; }
    public Guid? RiderId { get; init; }
    public string? TrackingNumber { get; init; }
}

/// <summary><c>PUT /api/staff/orders/{orderId}/lines/{lineId}/picked</c> (HO-P4 BG-4) -- tick or untick a line of the pick list.</summary>
public sealed class SetLinePickedRequest
{
    public bool Picked { get; init; }
}

/// <summary><c>POST /api/staff/riders</c> and <c>PUT /api/staff/riders/{riderId}</c> (HO-P4 BG-5). The mobile number is optional.</summary>
public sealed class RiderRequest
{
    public string Name { get; init; } = default!;
    public string? MobileNumber { get; init; }
    public bool IsActive { get; init; } = true;
}

public sealed class RecordTrackingNumberRequest
{
    public string TrackingNumber { get; init; } = default!;
}

/// <summary>Cash collected on delivery: <c>CollectorKind</c> is <c>Courier</c> (name the rider) or <c>Staff</c> (give the staff account).</summary>
public sealed class CodCollectionRequest
{
    public decimal Amount { get; init; }
    public string CollectorKind { get; init; } = default!;
    public string? CollectorName { get; init; }
    public Guid? CollectorStaffId { get; init; }
    public DateTimeOffset CollectedOn { get; init; }
}

/// <summary>Money taken when a pickup is collected: <c>Method</c> is <c>Cash</c> or <c>InStoreCard</c> (with the terminal slip reference -- never a card number).</summary>
public sealed class CollectionPaymentRequest
{
    public string Method { get; init; } = default!;
    public decimal Amount { get; init; }
    public string? Reference { get; init; }
}

/// <summary><c>POST /api/staff/orders/{orderId}/delivery</c> -- delivery of a delivery order or collection of a pickup order.</summary>
public sealed class RecordDeliveryRequest
{
    public int ExpectedVersion { get; init; }
    public DateTimeOffset DeliveredOn { get; init; }
    public CodCollectionRequest? CodCollection { get; init; }
    public CollectionPaymentRequest? CollectionPayment { get; init; }
}

public sealed class RecordDeliveryFailureRequest
{
    public string Reason { get; init; } = default!;
    public string? Note { get; init; }
}

public sealed class ReallocateOrderLineRequest
{
    public Guid TargetBatchId { get; init; }
    public string Reason { get; init; } = default!;
}
