namespace AmarGram.Domain.ValueObjects;

/// <summary>
/// HO-ORD-001 §8.3 (US-ORD-11) -- how an order left the shop: the courier (name snapshotted), the tracking number (manual -- there is no courier API,
/// SRS Q-4) and the tracking link built from the courier's https template, plus the last status a webhook reported. Replaced as a whole when tracking
/// is added or an event arrives.
/// </summary>
public sealed record Shipment
{
    /// <summary>The courier the order left with; <c>null</c> when it left with an in-house rider (HO-P4 BG-5, then <see cref="RiderId"/> is set).</summary>
    public Guid? CourierId { get; init; }
    public string CourierName { get; init; }
    public string? TrackingNumber { get; init; }
    public string? TrackingUrl { get; init; }
    public DateTimeOffset DispatchedOn { get; init; }
    public Guid DispatchedBy { get; init; }
    public string? LastTrackingStatus { get; init; }
    public DateTimeOffset? LastTrackingEventOn { get; init; }

    /// <summary>HO-P4 BG-5: the in-house rider the order left with, and the rider's name as it was at dispatch (a snapshot -- a rename never rewrites history).</summary>
    public Guid? RiderId { get; init; }
    public string? RiderName { get; init; }

    public bool IsRiderDelivery => RiderId is not null;

    public Shipment(
        Guid? courierId, string courierName, string? trackingNumber, string? trackingUrl, DateTimeOffset dispatchedOn, Guid dispatchedBy,
        string? lastTrackingStatus, DateTimeOffset? lastTrackingEventOn, Guid? riderId = null, string? riderName = null)
    {
        RiderId = riderId;
        RiderName = riderName;
        CourierId = courierId;
        CourierName = courierName;
        TrackingNumber = trackingNumber;
        TrackingUrl = trackingUrl;
        DispatchedOn = dispatchedOn;
        DispatchedBy = dispatchedBy;
        LastTrackingStatus = lastTrackingStatus;
        LastTrackingEventOn = lastTrackingEventOn;
    }

    /// <summary>HO-P4 BG-5: a dispatch to an in-house rider. The customer-facing carrier name is the fixed <see cref="AmarGram.Shared.Common.Constants.OrderRules.RiderCarrierName"/>; there is no tracking.</summary>
    public static Shipment ForRider(Guid riderId, string riderName, DateTimeOffset dispatchedOn, Guid dispatchedBy) =>
        new(null, AmarGram.Shared.Common.Constants.OrderRules.RiderCarrierName, null, null, dispatchedOn, dispatchedBy, null, null, riderId, riderName);

    private Shipment() => CourierName = default!;
}
