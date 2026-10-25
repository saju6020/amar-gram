using AmarGram.Application.Commands.Administration;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Administration;

/// <summary>
/// HO-P4 BG-23 -- set one cell of the roster grid: a staff member's shift for one date at one branch (Morning, Evening or Off).
/// Stored as roster exceptions with deterministic ids (<see cref="RosterCellIds"/>), so it overrides the weekly pattern for that date and a
/// second click re-sets the same rows instead of stacking new ones: a whole-day <c>ShiftCancelled</c> (clears the pattern, kept for every
/// value) plus an <c>ExtraShift</c> for Morning/Evening (retired for Off). The date is today or later in branch time. Exceptions entered by
/// hand through the exception form on that date are not touched; the cell read (<c>roster-cells</c>) reports the effective result, so the grid
/// shows Custom when one is present.
/// </summary>
public sealed class SetRosterShiftCommandHandler(
    IAggregateRootRepository<StaffRosterAggregate> rosterRepository,
    IAggregateRootRepository<RosterExceptionAggregate> exceptionRepository,
    IAggregateRootRepository<StaffAccountAggregate> staffRepository,
    IAggregateRootRepository<BranchAggregate> branchRepository,
    IAggregateRootRepository<StaffBranchAssignmentAggregate> assignmentRepository,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<SetRosterShiftCommand>
{
    public async Task<CommandResponse> HandleAsync(SetRosterShiftCommand command)
    {
        var shift = Enumeration.GetAll<RosterShift>().First(s => string.Equals(s.DisplayName, command.Shift, StringComparison.OrdinalIgnoreCase));

        var staff = await staffRepository.GetByIdAsync(command.StaffAccountId);
        if (staff is null || !staff.RoleIds.Intersect(StaffRosterRules.RosterableRoles, StringComparer.Ordinal).Any())
            return CreateBranchCommandHandler.Violation(BusinessViolationCodes.StaffNotRosterable, nameof(command.StaffAccountId), "This staff member does not hold a rosterable role.");

        var branch = await branchRepository.GetByIdAsync(command.BranchId);
        if (branch is null) return CreateBranchCommandHandler.Violation(BusinessViolationCodes.BranchNotFound, nameof(command.BranchId), "Branch not found.");

        var assignmentError = await RosterHandlerSupport.CheckBranchAssignmentAsync(assignmentRepository, branchRepository, command.StaffAccountId, command.BranchId);
        if (assignmentError is not null) return assignmentError;

        var today = BranchCalendar.LocalDateOf(timeProvider.GetUtcNow(), branch.TimeZoneId);
        if (command.Date < today)
            return CreateBranchCommandHandler.Violation(BusinessViolationCodes.ShiftDateInPast, nameof(command.Date), "A past day's shift cannot be changed.");

        try
        {
            await EnsureRosterAsync(command);

            await UpsertAsync(command, RosterCellPart.Base, RosterExceptionKind.ShiftCancelled, StaffRosterRules.DayStarts, StaffRosterRules.DayEnds, "Roster cell: day cleared");

            if (shift == RosterShift.Off)
            {
                await RetireAsync(command, RosterCellPart.Shift);
            }
            else
            {
                var (starts, ends) = RosterShiftCells.Hours(shift);
                await UpsertAsync(command, RosterCellPart.Shift, RosterExceptionKind.ExtraShift, starts, ends, $"Roster cell: {shift.DisplayName}");
            }
        }
        catch (DomainRuleViolationException ex)
        {
            return CreateBranchCommandHandler.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        return new CommandResponse { IsSuccess = true, Result = new { staffAccountId = command.StaffAccountId, date = command.Date, shift = shift.DisplayName } };
    }

    private async Task EnsureRosterAsync(SetRosterShiftCommand command)
    {
        var roster = await rosterRepository.GetByFilterAsync(r => r.StaffAccountId == command.StaffAccountId && r.BranchId == command.BranchId);
        if (roster is not null) return;

        roster = new StaffRosterAggregate(Guid.NewGuid());
        roster.Open(command.StaffAccountId, command.BranchId, command.UserContext!);
        await rosterRepository.SaveAsync(roster, EventPublishOption.InMemoryPublishOnly);
    }

    private async Task UpsertAsync(SetRosterShiftCommand command, RosterCellPart part, RosterExceptionKind kind, TimeOnly starts, TimeOnly ends, string reason)
    {
        var id = RosterCellIds.For(command.StaffAccountId, command.BranchId, command.Date, part);
        var dto = new RosterExceptionCreateDto(command.StaffAccountId, command.BranchId, command.Date, kind, starts, ends, reason, command.UserContext!, command.CorrelationId);

        var existing = await exceptionRepository.GetByIdAsync(id);
        if (existing is null)
        {
            var created = new RosterExceptionAggregate(id);
            created.Create(dto);
            await exceptionRepository.SaveAsync(created, EventPublishOption.InMemoryPublishOnly);
            return;
        }

        existing.Reshape(dto);
        await exceptionRepository.UpdateAsync(existing, EventPublishOption.InMemoryPublishOnly);
    }

    private async Task RetireAsync(SetRosterShiftCommand command, RosterCellPart part)
    {
        var existing = await exceptionRepository.GetByIdAsync(RosterCellIds.For(command.StaffAccountId, command.BranchId, command.Date, part));
        if (existing is null || existing.IsCancelled) return;

        existing.Retire(new RosterExceptionRetireDto(command.UserContext!, command.CorrelationId));
        await exceptionRepository.UpdateAsync(existing, EventPublishOption.InMemoryPublishOnly);
    }
}
