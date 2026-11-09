using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Xunit;

namespace AmarGram.Domain.Tests.DomainServices;

/// <summary>HO-P4 BG-23 -- a roster-grid cell is a whole-day cut plus an extra shift; the pure functions name it back, and the exception
/// aggregate re-sets / retires its own rows.</summary>
public sealed class RosterShiftCellsTests
{
    private static readonly DateOnly Monday = NextMonday();

    private static DateOnly NextMonday()
    {
        var d = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7);
        while (d.DayOfWeek != DayOfWeek.Monday) d = d.AddDays(1);
        return d;
    }

    private static StaffRosterAggregate Roster(params ShiftSlotInput[] pattern)
    {
        var roster = new StaffRosterAggregate(Guid.NewGuid());
        roster.Open(Guid.NewGuid(), Guid.NewGuid(), TestUserContext.Create());
        roster.SetCurrentPattern(new RosterCurrentPatternSetDto(pattern, Monday, TestUserContext.Create(), Guid.NewGuid()));
        return roster;
    }

    private static RosterExceptionAggregate Exception(StaffRosterAggregate roster, RosterExceptionKind kind, TimeOnly starts, TimeOnly ends, RosterCellPart part)
    {
        var e = new RosterExceptionAggregate(RosterCellIds.For(roster.StaffAccountId, roster.BranchId, Monday, part));
        e.Create(new RosterExceptionCreateDto(roster.StaffAccountId, roster.BranchId, Monday, kind, starts, ends, "cell", TestUserContext.Create(), Guid.NewGuid()));
        return e;
    }

    private static RosterExceptionAggregate Clear(StaffRosterAggregate r) =>
        Exception(r, RosterExceptionKind.ShiftCancelled, StaffRosterRules.DayStarts, StaffRosterRules.DayEnds, RosterCellPart.Base);

    private static RosterExceptionAggregate Extra(StaffRosterAggregate r, TimeOnly starts, TimeOnly ends) =>
        Exception(r, RosterExceptionKind.ExtraShift, starts, ends, RosterCellPart.Shift);

    [Fact]
    public void ADayWithNothingRostered_IsOff()
    {
        var roster = Roster();

        var slots = StaffAvailability.EffectiveSlots(roster, [], Monday);

        Assert.Equal(RosterShift.Off, RosterShiftCells.Classify(slots));
    }

    [Fact]
    public void TheWeeklyPatternsOwnHours_AreCustom_UnlessTheyMatchAPreset()
    {
        var custom = Roster(new ShiftSlotInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0)));
        var morning = Roster(new ShiftSlotInput(DayOfWeek.Monday, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds));

        Assert.Equal(RosterShift.Custom, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(custom, [], Monday)));
        Assert.Equal(RosterShift.Morning, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(morning, [], Monday)));
    }

    [Theory]
    [InlineData("Morning")]
    [InlineData("Evening")]
    public void TheCellsTwoExceptions_OverrideAPatternThatHasAnotherShift_WhateverOrderTheyAreStoredIn(string shiftName)
    {
        var shift = shiftName == "Morning" ? RosterShift.Morning : RosterShift.Evening;
        var roster = Roster(new ShiftSlotInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0)));
        var (starts, ends) = RosterShiftCells.Hours(shift);
        var cut = Clear(roster);
        var extra = Extra(roster, starts, ends);

        Assert.Equal(shift, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(roster, [cut, extra], Monday)));
        Assert.Equal(shift, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(roster, [extra, cut], Monday)));
    }

    [Fact]
    public void AnOffCell_IsJustTheCut_AndLeavesNoShift()
    {
        var roster = Roster(new ShiftSlotInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0)));
        var cut = Clear(roster);
        var extra = Extra(roster, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds);
        extra.Retire(new RosterExceptionRetireDto(TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(RosterShift.Off, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(roster, [cut, extra], Monday)));
    }

    [Fact]
    public void AHandEnteredExtraShift_OnTopOfACell_ReadsAsCustom()
    {
        var roster = Roster();
        var cut = Clear(roster);
        var extra = Extra(roster, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds);
        var manual = new RosterExceptionAggregate(Guid.NewGuid());
        manual.Create(new RosterExceptionCreateDto(roster.StaffAccountId, roster.BranchId, Monday, RosterExceptionKind.ExtraShift,
            new TimeOnly(18, 0), new TimeOnly(21, 0), "Late cover", TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal(RosterShift.Custom, RosterShiftCells.Classify(StaffAvailability.EffectiveSlots(roster, [cut, extra, manual], Monday)));
    }

    [Fact]
    public void TheCellIds_AreStablePerStaffBranchDateAndPart_AndDifferAcrossThem()
    {
        var staff = Guid.NewGuid();
        var branch = Guid.NewGuid();

        Assert.Equal(RosterCellIds.For(staff, branch, Monday, RosterCellPart.Base), RosterCellIds.For(staff, branch, Monday, RosterCellPart.Base));
        Assert.NotEqual(RosterCellIds.For(staff, branch, Monday, RosterCellPart.Base), RosterCellIds.For(staff, branch, Monday, RosterCellPart.Shift));
        Assert.NotEqual(RosterCellIds.For(staff, branch, Monday, RosterCellPart.Base), RosterCellIds.For(staff, branch, Monday.AddDays(1), RosterCellPart.Base));
        Assert.NotEqual(RosterCellIds.For(staff, branch, Monday, RosterCellPart.Base), RosterCellIds.For(Guid.NewGuid(), branch, Monday, RosterCellPart.Base));
    }

    [Fact]
    public void Reshape_ChangesTheShift_AndReactivatesARetiredRow()
    {
        var roster = Roster();
        var extra = Extra(roster, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds);
        extra.Retire(new RosterExceptionRetireDto(TestUserContext.Create(), Guid.NewGuid()));
        Assert.True(extra.IsCancelled);

        extra.Reshape(new RosterExceptionCreateDto(roster.StaffAccountId, roster.BranchId, Monday, RosterExceptionKind.ExtraShift,
            StaffRosterRules.EveningStarts, StaffRosterRules.EveningEnds, "cell", TestUserContext.Create(), Guid.NewGuid()));

        Assert.False(extra.IsCancelled);
        Assert.Equal(StaffRosterRules.EveningStarts, extra.Starts);
    }

    [Fact]
    public void Reshape_CannotMoveToAnotherDay()
    {
        var roster = Roster();
        var extra = Extra(roster, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds);

        var ex = Assert.Throws<DomainRuleViolationException>(() => extra.Reshape(new RosterExceptionCreateDto(
            roster.StaffAccountId, roster.BranchId, Monday.AddDays(1), RosterExceptionKind.ExtraShift,
            StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds, "cell", TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.InvalidShiftSlot, ex.ErrorCode);
    }

    [Fact]
    public void Retire_IsIdempotent_AndWorksOnTodayWhichCancelRefuses()
    {
        var roster = Roster();
        var extra = Extra(roster, StaffRosterRules.MorningStarts, StaffRosterRules.MorningEnds);

        extra.Retire(new RosterExceptionRetireDto(TestUserContext.Create(), Guid.NewGuid()));
        var version = extra.Version;
        extra.Retire(new RosterExceptionRetireDto(TestUserContext.Create(), Guid.NewGuid()));

        Assert.True(extra.IsCancelled);
        Assert.Equal(version, extra.Version);
    }

    [Fact]
    public void ExistingBehaviour_ACutOnAPatternShift_StillShortensIt()
    {
        var roster = Roster(new ShiftSlotInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0)));
        var cut = Exception(roster, RosterExceptionKind.ShiftCancelled, new TimeOnly(9, 0), new TimeOnly(12, 0), RosterCellPart.Base);

        var slots = StaffAvailability.EffectiveSlots(roster, [cut], Monday);

        Assert.Equal([(new TimeOnly(12, 0), new TimeOnly(17, 0))], slots);
    }
}
