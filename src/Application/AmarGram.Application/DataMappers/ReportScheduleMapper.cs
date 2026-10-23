using AmarGram.Application.Commands.Reporting;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Application.DataMappers;

/// <summary>HO-RPT-001 section 11.3 -- command to domain input. The definition and the zone are resolved by the handler.</summary>
public static class ReportScheduleMapper
{
    public static ReportScheduleDto ToDomainDto(this ReportScheduleCommandBase command, ReportDefinition definition, TimeZoneInfo zone, DateTimeOffset now) =>
        new(command.Name, definition, command.BranchId, command.Period, command.Parameters, command.Format, command.Frequency, command.DayOfWeek, command.DayOfMonth,
            command.LastDayOfMonth, command.SendAtLocal, command.RecipientIds, zone, now, command.UserContext!);
}
