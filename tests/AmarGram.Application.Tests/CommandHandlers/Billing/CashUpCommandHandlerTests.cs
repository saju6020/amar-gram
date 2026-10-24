using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Application.CommandHandlers.Billing;
using AmarGram.Application.Commands.Billing;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Tests.CommandHandlers.Billing;

/// <summary>HO-BIL-001 section 15 U-F2..U-F4 at the handler level -- load-or-create, the version guard, the pending-approval block and the
/// frozen snapshot (US-BIL-12, ADR-188).</summary>
public sealed class CashUpCommandHandlerTests
{
    private readonly FakeAggregateRootRepository<CashUpAggregate> _cashUps = new();
    private readonly FakeAggregateRootRepository<BranchAggregate> _branches = new();
    private readonly FakeBillingFinder _finder = new();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 7, 6, 0, 0, TimeSpan.Zero));
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly UserContext _staff = TestUserContext.Create();
    private static readonly DateOnly Day = new(2026, 10, 7);

    public CashUpCommandHandlerTests()
    {
        var branch = new BranchAggregate(_branchId);
        branch.Create(new BranchCreateDto("MAIN", "Main", "Asia/Dhaka", null, null, null, TestUserContext.Create(), Guid.NewGuid()));
        _branches.Seed(branch);
    }

    private RecordCashCountCommandHandler Count() => new(_cashUps, _branches, _finder, _time);
    private CloseCashUpCommandHandler Close() => new(_cashUps, _branches, _finder, _time);

    private RecordCashCountCommand CountCommand(decimal counted, DateOnly? date = null, string? explanation = null) => new()
    {
        BranchId = _branchId, BusinessDate = date ?? Day, CountedCash = counted, Explanation = explanation, UserContext = _staff, CorrelationId = Guid.NewGuid(),
    };

    private CloseCashUpCommand CloseCommand(int version) => new()
    { BranchId = _branchId, BusinessDate = Day, ExpectedVersion = version, UserContext = _staff, CorrelationId = Guid.NewGuid() };

    private static string CodeOf(CommandResponse response) => response.ValidationResult!.Errors.Single().ErrorCode;

    [Fact]
    public async Task C20_TheFirstCountCreatesTheDay_AndARecountReplacesIt()
    {
        Assert.True((await Count().HandleAsync(CountCommand(100m))).IsSuccess);
        Assert.Single(_cashUps.Saved);

        Assert.True((await Count().HandleAsync(CountCommand(120m))).IsSuccess);
        Assert.Single(_cashUps.Saved);
        Assert.Equal(120m, _cashUps.Saved.Single().CountedCash);
        Assert.NotEmpty(_cashUps.Updated);
    }

    [Fact]
    public async Task U_F4_AFutureDayCannotBeCounted_AndAClosedDayCannotBeRecounted()
    {
        Assert.Equal(BusinessViolationCodes.CashUpDateInFuture, CodeOf(await Count().HandleAsync(CountCommand(10m, Day.AddDays(2)))));

        await Count().HandleAsync(CountCommand(0m));
        var cashUp = _cashUps.Saved.Single();
        Assert.True((await Close().HandleAsync(CloseCommand(cashUp.Version))).IsSuccess);
        Assert.Equal(BusinessViolationCodes.CashUpClosed, CodeOf(await Count().HandleAsync(CountCommand(5m))));
    }

    [Fact]
    public async Task U_F3_APendingApproval_BlocksTheClose()
    {
        await Count().HandleAsync(CountCommand(0m));
        _finder.PendingApprovals = 1;

        var response = await Close().HandleAsync(CloseCommand(_cashUps.Saved.Single().Version));

        Assert.Equal(BusinessViolationCodes.PendingApprovalsExist, CodeOf(response));
        Assert.Equal(CashUpStatus.Open, _cashUps.Saved.Single().Status);
    }

    [Fact]
    public async Task U_F2_AVarianceNeedsAnExplanation_AndTheSnapshotIsFrozen()
    {
        _finder.CashUpRowsOfTheDay.Add(new CashUpRow(Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CashInStore, null, null, 100m, false));
        await Count().HandleAsync(CountCommand(90m));
        var cashUp = _cashUps.Saved.Single();

        Assert.Equal(BusinessViolationCodes.VarianceExplanationRequired, CodeOf(await Close().HandleAsync(CloseCommand(cashUp.Version))));

        await Count().HandleAsync(CountCommand(90m, explanation: "Short by ten"));
        Assert.True((await Close().HandleAsync(CloseCommand(cashUp.Version))).IsSuccess);
        Assert.Equal(-10m, cashUp.Variance);
        Assert.Equal(100m, cashUp.ExpectedSnapshot!.ExpectedCash);
    }

    // ── HO-P4 BG-20: the count per source ────────────────────────────────────────────────────────

    private static readonly Guid Collector = Guid.NewGuid();

    private void SeedTillAndCollectorCash()
    {
        _finder.CashUpRowsOfTheDay.Add(new CashUpRow(Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CashInStore, null, null, 100m, false));
        _finder.CashUpRowsOfTheDay.Add(new CashUpRow(
            Guid.NewGuid(), CashUpRowKind.Payment, PaymentMethod.CashOnDelivery, CollectorKind.Staff, null, 40m, false, null,
            CashUpSources.StaffKey(Collector), "Rina"));
    }

    private RecordCashCountCommand SourceCountCommand(params (string Key, decimal Counted)[] counts) => new()
    {
        BranchId = _branchId, BusinessDate = Day, CountedCash = 0m, Counts = counts.Select(c => new CashUpSourceCountInput(c.Key, c.Counted)).ToList(),
        Explanation = "counted by source", UserContext = _staff, CorrelationId = Guid.NewGuid(),
    };

    [Fact]
    public async Task BG20_ACountBySource_StoresTheServersTotal_AndIgnoresTheTotalField()
    {
        SeedTillAndCollectorCash();

        var response = await Count().HandleAsync(SourceCountCommand((CashUpSources.TillKey, 95m), (CashUpSources.StaffKey(Collector), 40m)));

        Assert.True(response.IsSuccess);
        var cashUp = _cashUps.Saved.Single();
        Assert.Equal(135m, cashUp.CountedCash);
        Assert.Equal(2, cashUp.SourceCounts.Count);
        Assert.Equal("Rina", cashUp.SourceCounts.Single(c => c.Key == CashUpSources.StaffKey(Collector)).Label);
    }

    [Fact]
    public async Task BG20_ASourceTheDayDoesNotHave_IsRefused()
    {
        SeedTillAndCollectorCash();

        var response = await Count().HandleAsync(SourceCountCommand(("staff:" + Guid.NewGuid(), 10m)));

        Assert.Equal(BusinessViolationCodes.UnknownCashUpSource, CodeOf(response));
    }

    [Fact]
    public async Task BG20_Close_FreezesTheSourcesExpected_AndTheOverallVarianceIsTheSumOfTheSources()
    {
        SeedTillAndCollectorCash();
        // The till is 5 short; the collector is 10 over; an uncounted source would have been counted as nothing.
        await Count().HandleAsync(SourceCountCommand((CashUpSources.TillKey, 95m), (CashUpSources.StaffKey(Collector), 50m)));
        var cashUp = _cashUps.Saved.Single();

        Assert.True((await Close().HandleAsync(CloseCommand(cashUp.Version))).IsSuccess);

        Assert.Equal(5m, cashUp.Variance);
        Assert.Equal(2, cashUp.ExpectedSources.Count);
        Assert.Equal(100m, cashUp.ExpectedSources.Single(s => s.Key == CashUpSources.TillKey).ExpectedCash);
        Assert.Equal(40m, cashUp.ExpectedSources.Single(s => s.Key == CashUpSources.StaffKey(Collector)).ExpectedCash);
    }

    [Fact]
    public async Task BG20_ATotalOnlyRecount_ClearsThePerSourceCounts()
    {
        SeedTillAndCollectorCash();
        await Count().HandleAsync(SourceCountCommand((CashUpSources.TillKey, 95m)));

        await Count().HandleAsync(CountCommand(140m));

        Assert.Empty(_cashUps.Saved.Single().SourceCounts);
        Assert.Equal(140m, _cashUps.Saved.Single().CountedCash);
    }

    [Fact]
    public async Task AStaleVersion_AndAnUncountedDay_AreRefused()
    {
        Assert.Equal(BusinessViolationCodes.CountRequired, CodeOf(await Close().HandleAsync(CloseCommand(0))));

        await Count().HandleAsync(CountCommand(0m));
        Assert.Equal(BusinessViolationCodes.StaleVersion, CodeOf(await Close().HandleAsync(CloseCommand(_cashUps.Saved.Single().Version + 3))));
    }
}
