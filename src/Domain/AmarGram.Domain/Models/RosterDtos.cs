using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record ShiftSlotInput(DayOfWeek DayOfWeek, TimeOnly Starts, TimeOnly Ends);

public sealed record RosterCurrentPatternSetDto(
    IReadOnlyList<ShiftSlotInput> Slots, DateOnly Today, UserContext UserContext, Guid CorrelationId);

public sealed record RosterNextPatternScheduleDto(
    IReadOnlyList<ShiftSlotInput> Slots, DateOnly EffectiveFrom, DateOnly Today, UserContext UserContext, Guid CorrelationId);

public sealed record RosterNextPatternCancelDto(UserContext UserContext, Guid CorrelationId);

public sealed record RosterPatternPromoteDto(DateOnly AsOf, UserContext UserContext, Guid CorrelationId);

public sealed record RosterExceptionCreateDto(
    Guid StaffAccountId, Guid BranchId, DateOnly Date, AmarGram.Shared.Common.Enums.RosterExceptionKind Kind,
    TimeOnly Starts, TimeOnly Ends, string Reason, UserContext UserContext, Guid CorrelationId);

/// <summary>HO-P4 BG-23.</summary>
public sealed record RosterExceptionRetireDto(UserContext UserContext, Guid CorrelationId);

public sealed record RosterExceptionCancelDto(DateOnly Today, UserContext UserContext, Guid CorrelationId);
