using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.ValueObjects;

/// <summary>HO-P3 G4 -- the per-order note for the rider is part of the fulfilment snapshot and is personal data.</summary>
public sealed class FulfilmentRiderNoteTests
{
    private static FulfilmentDetails Details(string? riderNote) => new(
        "Rahima Begum", "01711000000", "House 4", null, "Dhaka", "Dhaka", "1212", "Gate code 1234",
        Guid.NewGuid(), "Dhaka", DeliveryServiceLevel.Standard, null, null, null, null, null, riderNote);

    [Fact]
    public void RiderNote_IsKeptInTheSnapshot_AndIsOptional()
    {
        Assert.Equal("Please call at the gate", Details("Please call at the gate").RiderNote);
        Assert.Null(Details(null).RiderNote);
    }

    [Fact]
    public void Redacted_ReplacesTheRiderNote_ButLeavesAnAbsentOneAbsent()
    {
        Assert.Equal(FulfilmentDetails.RedactedText, Details("Please call at the gate").Redacted().RiderNote);
        Assert.Null(Details(null).Redacted().RiderNote);
    }
}
