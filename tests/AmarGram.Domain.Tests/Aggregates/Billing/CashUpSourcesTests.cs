using AmarGram.Domain.Aggregates.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates.Billing;

/// <summary>HO-P4 BG-20 -- the cash-up per source: the calculator's split, the reconciliation, and the aggregate's per-source count.</summary>
public sealed class CashUpSourcesTests
{
    private static readonly DateOnly Day = new(2026, 10, 7);
    private static readonly DateTimeOffset Now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Rina = Guid.NewGuid();
    private static readonly Guid Karim = Guid.NewGuid();

    private static CashUpRow InStore(decimal amount, bool carried = false) =>
        new(Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CashInStore, null, null, amount, carried);

    private static CashUpRow StaffCod(Guid staff, string name, decimal amount, CashUpRowKind kind = CashUpRowKind.Payment) =>
        new(Guid.NewGuid(), kind, PaymentMethod.CashOnDelivery, CollectorKind.Staff, null, amount, false, null, CashUpSources.StaffKey(staff), name);

    private static CashUpAggregate Open()
    {
        var cashUp = new CashUpAggregate(CashUpIds.For(Guid.NewGuid(), Day));
        cashUp.Open(Guid.NewGuid(), Day, BillingTestData.Actor().UserContext);
        return cashUp;
    }

    [Fact]
    public void CalculateSources_SplitsTheExpectedCashByWhereItIsHeld_AndSumsToTheExpectedCash()
    {
        var rows = new[]
        {
            InStore(500m), InStore(200m),
            new CashUpRow(Guid.NewGuid(), CashUpRowKind.Refund, null, null, RefundMethod.CashInStore, 100m, false),
            StaffCod(Rina, "Rina", 300m), StaffCod(Karim, "Karim", 80m),
            StaffCod(Rina, "Rina", 50m, CashUpRowKind.Reversal),
            // Not cash anywhere: card, transfer, courier-held COD.
            new CashUpRow(Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CardInStore, null, null, 999m, false),
            new CashUpRow(Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CashOnDelivery, CollectorKind.Courier, null, 777m, false),
        };

        var sources = CashUpCalculator.CalculateSources(rows);

        Assert.Equal(CashUpSources.TillKey, sources[0].Key);
        Assert.Equal(600m, sources.Single(s => s.Key == CashUpSources.TillKey).ExpectedCash);
        Assert.Equal(250m, sources.Single(s => s.Key == CashUpSources.StaffKey(Rina)).ExpectedCash);
        Assert.Equal(80m, sources.Single(s => s.Key == CashUpSources.StaffKey(Karim)).ExpectedCash);
        Assert.Equal(CashUpCalculator.Calculate(rows).ExpectedCash, sources.Sum(s => s.ExpectedCash));
    }

    [Fact]
    public void CalculateSources_ATillIsAlwaysListed_EvenOnADayWithNoCash()
    {
        var sources = CashUpCalculator.CalculateSources([]);

        var till = Assert.Single(sources);
        Assert.Equal((CashUpSources.TillKey, 0m), (till.Key, till.ExpectedCash));
    }

    [Fact]
    public void CalculateSources_CarriedInItems_AreAttributedToTheirSource()
    {
        var sources = CashUpCalculator.CalculateSources([InStore(10m), InStore(25m, carried: true)]);

        Assert.Equal(35m, Assert.Single(sources).ExpectedCash);
    }

    [Fact]
    public void Reconcile_Open_AnUncountedSourceHasNoCountOrVariance_AndACountedOneHasTheSignedVariance()
    {
        var expected = new[] { new CashUpSourceExpected("till", "Till", 600m), new CashUpSourceExpected("staff:x", "Rina", 250m) };
        var counted = new[] { new CashUpSourceCount("till", "Till", 590m) };

        var rows = CashUpSources.Reconcile(expected, counted, missingCountIsZero: false);

        Assert.Equal((590m, -10m), (rows[0].CountedCash, rows[0].Variance));
        Assert.Null(rows[1].CountedCash);
        Assert.Null(rows[1].Variance);
    }

    [Fact]
    public void Reconcile_Closed_AnUncountedSourceWasCountedAsNothing()
    {
        var expected = new[] { new CashUpSourceExpected("till", "Till", 600m), new CashUpSourceExpected("staff:x", "Rina", 250m) };
        var counted = new[] { new CashUpSourceCount("till", "Till", 600m) };

        var rows = CashUpSources.Reconcile(expected, counted, missingCountIsZero: true);

        Assert.Equal((0m, -250m), (rows[1].CountedCash, rows[1].Variance));
    }

    [Fact]
    public void Reconcile_ATotalOnlyDay_HasNoPerSourceCounts_EvenWhenClosed()
    {
        var rows = CashUpSources.Reconcile([new CashUpSourceExpected("till", "Till", 600m)], [], missingCountIsZero: true);

        Assert.Null(Assert.Single(rows).CountedCash);
    }

    [Fact]
    public void Reconcile_AVarianceOverIsPositive()
    {
        var rows = CashUpSources.Reconcile([new CashUpSourceExpected("till", "Till", 100m)], [new CashUpSourceCount("till", "Till", 112.50m)], false);

        Assert.Equal(12.50m, Assert.Single(rows).Variance);
    }

    [Fact]
    public void RecordSourceCounts_SetsTheTotalToTheSum_AndKeepsEachSource()
    {
        var cashUp = Open();

        cashUp.RecordSourceCounts(
            [new CashUpSourceCount("till", "Till", 95m), new CashUpSourceCount("staff:x", "Rina", 40.25m)],
            ["till", "staff:x"], "ok", Day, Now, BillingTestData.Actor());

        Assert.Equal(135.25m, cashUp.CountedCash);
        Assert.Equal(2, cashUp.SourceCounts.Count);
    }

    [Fact]
    public void RecordSourceCounts_ASourceTheDayDoesNotHave_IsRefused()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().RecordSourceCounts(
            [new CashUpSourceCount("staff:other", "?", 1m)], ["till"], null, Day, Now, BillingTestData.Actor()));

        Assert.Equal(BusinessViolationCodes.UnknownCashUpSource, ex.ErrorCode);
    }

    [Fact]
    public void RecordSourceCounts_ASourceCountedTwice_IsRefused()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().RecordSourceCounts(
            [new CashUpSourceCount("till", "Till", 1m), new CashUpSourceCount("till", "Till", 2m)], ["till"], null, Day, Now, BillingTestData.Actor()));

        Assert.Equal(BusinessViolationCodes.DuplicateCashUpSource, ex.ErrorCode);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1.005)]
    public void RecordSourceCounts_ANegativeOrThreeDecimalAmount_IsRefused(double amount)
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().RecordSourceCounts(
            [new CashUpSourceCount("till", "Till", (decimal)amount)], ["till"], null, Day, Now, BillingTestData.Actor()));

        Assert.Equal(BusinessViolationCodes.InvalidAmount, ex.ErrorCode);
    }

    [Fact]
    public void RecordSourceCounts_NoSources_IsRefused()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().RecordSourceCounts([], ["till"], null, Day, Now, BillingTestData.Actor()));

        Assert.Equal(BusinessViolationCodes.CountRequired, ex.ErrorCode);
    }

    [Fact]
    public void RecordSourceCounts_AFutureDay_IsRefused_LikeATotalCount()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().RecordSourceCounts(
            [new CashUpSourceCount("till", "Till", 1m)], ["till"], null, Day.AddDays(-1), Now, BillingTestData.Actor()));

        Assert.Equal(BusinessViolationCodes.CashUpDateInFuture, ex.ErrorCode);
    }

    [Fact]
    public void Close_FreezesTheSources_AndTheVarianceIsTheSumOfTheSourceVariances()
    {
        var cashUp = Open();
        var rows = new[] { InStore(100m), StaffCod(Rina, "Rina", 40m) };
        cashUp.RecordSourceCounts(
            [new CashUpSourceCount("till", "Till", 95m), new CashUpSourceCount(CashUpSources.StaffKey(Rina), "Rina", 50m)],
            [CashUpSources.TillKey, CashUpSources.StaffKey(Rina)], "till short, Rina over", Day, Now, BillingTestData.Actor());

        cashUp.Close(CashUpCalculator.Calculate(rows), Now, BillingTestData.Actor(), CashUpCalculator.CalculateSources(rows));

        var perSource = CashUpSources.Reconcile(cashUp.ExpectedSources, cashUp.SourceCounts, missingCountIsZero: true);
        Assert.Equal(cashUp.Variance, perSource.Sum(s => s.Variance));
        Assert.Equal(5m, cashUp.Variance);
    }
}
