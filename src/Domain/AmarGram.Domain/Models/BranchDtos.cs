using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record OpeningIntervalInput(DayOfWeek DayOfWeek, TimeOnly Opens, TimeOnly Closes);

/// <remarks>HO-P4 BG-21: <paramref name="Type"/> null means an Outlet on create.</remarks>
public sealed record BranchCreateDto(
    string Code, string Name, string TimeZoneId, string? AddressLine, string? PhoneNumber, string? Email,
    UserContext UserContext, Guid CorrelationId, AmarGram.Shared.Common.Enums.BranchType? Type = null);

/// <remarks>HO-P4 BG-21: <paramref name="Type"/> null leaves the branch's type as it is.</remarks>
public sealed record BranchDetailsUpdateDto(
    string Name, string TimeZoneId, string? AddressLine, string? PhoneNumber, string? Email,
    UserContext UserContext, Guid CorrelationId, AmarGram.Shared.Common.Enums.BranchType? Type = null);

public sealed record BranchWeeklyHoursDto(
    IReadOnlyList<OpeningIntervalInput> Intervals, UserContext UserContext, Guid CorrelationId);

public sealed record BranchActivationDto(bool IsActive, UserContext UserContext, Guid CorrelationId);
