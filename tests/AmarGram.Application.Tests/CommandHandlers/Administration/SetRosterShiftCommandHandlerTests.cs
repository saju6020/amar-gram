using AmarGram.Application.CommandHandlers.Administration;
using AmarGram.Application.Commands.Administration;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Tests.CommandHandlers.Administration;

/// <summary>HO-P4 BG-23 -- the roster-grid cell command: stored as the cell's two exceptions, re-set in place, never stacked.</summary>
public sealed class SetRosterShiftCommandHandlerTests
{
    private readonly FakeAggregateRootRepository<StaffRosterAggregate> _rosters = new();
    private readonly FakeAggregateRootRepository<RosterExceptionAggregate> _exceptions = new();
    private readonly FakeAggregateRootRepository<StaffAccountAggregate> _staff = new();
    private readonly FakeAggregateRootRepository<BranchAggregate> _branches = new();
    private readonly FakeAggregateRootRepository<StaffBranchAssignmentAggregate> _assignments = new();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero)); // 10:00 in Dhaka
    private readonly UserContext _admin = TestUserContext.Create();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();
    private static readonly DateOnly Today = new(2026, 10, 25);

    public SetRosterShiftCommandHandlerTests()
    {
        var branch = new BranchAggregate(_branchId);
        branch.Create(new BranchCreateDto("MAIN", "Main", "Asia/Dhaka", null, null, null, TestUserContext.Create(), Guid.NewGuid()));
        _branches.Seed(branch);

        AddStaff(_staffId, StaffRoles.Reception);
    }

    private void AddStaff(Guid id, string role)
    {
        var account = new StaffAccountAggregate(id);
        account.Create(new StaffAccountCreationDto("Staff", MobileNumber.Create("01712345678"), null, [role], TestUserContext.Create(), Guid.NewGuid()));
        _staff.Seed(account);
    }

    private SetRosterShiftCommandHandler Handler(FakeTimeProvider? time = null) => new(_rosters, _exceptions, _staff, _branches, _assignments, time ?? _time);

    private SetRosterShiftCommand Command(string shift, DateOnly? date = null, Guid? staffId = null) => new()
    {
        StaffAccountId = staffId ?? _staffId, BranchId = _branchId, Date = date ?? Today.AddDays(1), Shift = shift,
        UserContext = _admin, CorrelationId = Guid.NewGuid()
    };

    private RosterExceptionAggregate? Row(DateOnly date, RosterCellPart part) =>
        _exceptions.Saved.Concat(_exceptions.Updated).FirstOrDefault(e => e.Id == RosterCellIds.For(_staffId, _branchId, date, part));

    private static string CodeOf(CommandResponse response) => response.ValidationResult!.Errors.Single().ErrorCode;

    [Theory]
    [InlineData("Morning", 8, 14)]
    [InlineData("Evening", 14, 20)]
    public async Task AShift_WritesTheWholeDayCut_AndTheShiftsExtraRow(string shift, int from, int to)
    {
        var date = Today.AddDays(1);

        var response = await Handler().HandleAsync(Command(shift, date));

        Assert.True(response.IsSuccess);
        var cut = Row(date, RosterCellPart.Base)!;
        Assert.Equal(RosterExceptionKind.ShiftCancelled, cut.Kind);
        Assert.False(cut.IsCancelled);
        var extra = Row(date, RosterCellPart.Shift)!;
        Assert.Equal(RosterExceptionKind.ExtraShift, extra.Kind);
        Assert.Equal((new TimeOnly(from, 0), new TimeOnly(to, 0)), (extra.Starts, extra.Ends));
        Assert.Single(_rosters.Saved);
    }

    [Fact]
    public async Task Off_KeepsTheCut_AndWritesNoShiftRow()
    {
        var date = Today.AddDays(1);

        Assert.True((await Handler().HandleAsync(Command("Off", date))).IsSuccess);

        Assert.NotNull(Row(date, RosterCellPart.Base));
        Assert.Null(Row(date, RosterCellPart.Shift));
    }

    [Fact]
    public async Task ClickingOnAgain_ReSetsTheSameRows_InsteadOfStackingNewOnes()
    {
        var date = Today.AddDays(1);
        await Handler().HandleAsync(Command("Morning", date));
        await Handler().HandleAsync(Command("Evening", date));
        await Handler().HandleAsync(Command("Off", date));
        await Handler().HandleAsync(Command("Morning", date));

        Assert.Equal(2, _exceptions.Saved.Count); // one cut, one shift -- created once each
        var extra = Row(date, RosterCellPart.Shift)!;
        Assert.False(extra.IsCancelled);
        Assert.Equal(new TimeOnly(8, 0), extra.Starts);
        Assert.Single(_rosters.Saved); // the roster itself is created once
    }

    [Fact]
    public async Task OffAfterAShift_RetiresTheShiftRow()
    {
        var date = Today.AddDays(1);
        await Handler().HandleAsync(Command("Evening", date));

        await Handler().HandleAsync(Command("Off", date));

        Assert.True(Row(date, RosterCellPart.Shift)!.IsCancelled);
        Assert.False(Row(date, RosterCellPart.Base)!.IsCancelled);
    }

    [Fact]
    public async Task Today_CanBeSet_Yesterday_CannotBe()
    {
        Assert.True((await Handler().HandleAsync(Command("Morning", Today))).IsSuccess);

        var response = await Handler().HandleAsync(Command("Morning", Today.AddDays(-1)));

        Assert.Equal(BusinessViolationCodes.ShiftDateInPast, CodeOf(response));
        Assert.Null(Row(Today.AddDays(-1), RosterCellPart.Base));
    }

    [Fact]
    public async Task TheDateIsJudgedInBranchTime_NotUtc()
    {
        // 20:00 UTC on the 24th is already 02:00 on the 25th in Dhaka: the 24th is yesterday there.
        var late = new FakeTimeProvider(new DateTimeOffset(2026, 10, 24, 20, 0, 0, TimeSpan.Zero));

        Assert.Equal(BusinessViolationCodes.ShiftDateInPast, CodeOf(await Handler(late).HandleAsync(Command("Off", new DateOnly(2026, 10, 24)))));
        Assert.True((await Handler(late).HandleAsync(Command("Off", new DateOnly(2026, 10, 25)))).IsSuccess);
    }

    [Fact]
    public async Task AStaffMemberWithoutARosterableRole_IsRefused()
    {
        var other = Guid.NewGuid();
        AddStaff(other, StaffRoles.Accountant);

        var response = await Handler().HandleAsync(Command("Morning", staffId: other));

        Assert.Equal(BusinessViolationCodes.StaffNotRosterable, CodeOf(response));
        Assert.Empty(_exceptions.Saved);
    }

    [Fact]
    public async Task AnUnknownBranch_AndAnUnassignedStaffMember_AreRefused()
    {
        var forTheMainBranch = Command("Morning");
        var response = await Handler().HandleAsync(new SetRosterShiftCommand
        {
            StaffAccountId = _staffId, BranchId = Guid.NewGuid(), Date = Today.AddDays(1), Shift = "Morning", UserContext = _admin, CorrelationId = Guid.NewGuid()
        });
        Assert.Equal(BusinessViolationCodes.BranchNotFound, CodeOf(response));

        // A second active branch ends the sole-branch rule, so the staff member must now be assigned explicitly.
        var second = new BranchAggregate(Guid.NewGuid());
        second.Create(new BranchCreateDto("SEC", "Second", "Asia/Dhaka", null, null, null, TestUserContext.Create(), Guid.NewGuid()));
        _branches.Seed(second);

        Assert.Equal(BusinessViolationCodes.BranchNotAssigned, CodeOf(await Handler().HandleAsync(forTheMainBranch)));
    }
}
