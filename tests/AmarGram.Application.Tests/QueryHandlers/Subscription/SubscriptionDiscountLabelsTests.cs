using AmarGram.Read.QueryHandlers.Subscription;

namespace AmarGram.Application.Tests.QueryHandlers.Subscription;

/// <summary>Owner decision 2026-11-09 -- an invoice's discount total is named only when every discounted line carries the same name.</summary>
public sealed class SubscriptionDiscountLabelsTests
{
    private const string Ten = "Subscription discount (10%)";

    [Fact]
    public void AllDiscountedLinesShareOneLabel_TheTotalsAreNamed() =>
        Assert.Equal(Ten, SubscriptionDiscountLabels.TotalsLabel([(18m, Ten), (9m, Ten), (0m, null)]));

    [Fact]
    public void ASubscriptionLineBesideAnOrdinaryDiscountedLine_LeavesTheTotalsUnnamed() =>
        Assert.Null(SubscriptionDiscountLabels.TotalsLabel([(18m, Ten), (5m, null)]));

    [Fact]
    public void TwoDifferentPercentages_LeaveTheTotalsUnnamed() =>
        Assert.Null(SubscriptionDiscountLabels.TotalsLabel([(18m, Ten), (9m, "Subscription discount (5%)")]));

    [Fact]
    public void NoDiscountedLine_MeansNoLabel() =>
        Assert.Null(SubscriptionDiscountLabels.TotalsLabel([(0m, null), (0m, Ten)]));
}
