namespace AmarGram.Read.ViewModels;

/// <summary>HO-ADM-001 §12.4 -- times as "HH:mm", dates as "yyyy-MM-dd", instants ISO-8601 with offset.</summary>
public sealed record OpeningIntervalViewModel(string DayOfWeek, string Opens, string Closes);

public sealed record BranchSummaryViewModel(
    Guid Id, string Name, string? AddressLine, string? PhoneNumber, string? Email, string TimeZoneId,
    IReadOnlyList<OpeningIntervalViewModel> WeeklyHours);

/// <summary>
/// HO-P4 BG-21 adds <paramref name="Type"/> (Outlet or Warehouse), <paramref name="TodayHours"/> (branch-local today, closures applied),
/// <paramref name="DeliveryAreas"/> (names of the branch's active delivery zones, in priority order) and <paramref name="ActiveStaffCount"/>
/// (staff accounts assigned to the branch). The address is the existing <paramref name="AddressLine"/>.
/// </summary>
public sealed record AdminBranchViewModel(
    Guid Id, string Code, string Name, string TimeZoneId, string? AddressLine, string? PhoneNumber,
    string? Email, bool IsActive, IReadOnlyList<OpeningIntervalViewModel> WeeklyHours,
    string Type, BranchTodayHoursViewModel TodayHours, IReadOnlyList<string> DeliveryAreas, int ActiveStaffCount);

/// <summary><paramref name="Summary"/> is "HH:mm-HH:mm" per interval joined by ", ", or "Closed"; <paramref name="Date"/> is the branch-local day.</summary>
public sealed record BranchTodayHoursViewModel(DateOnly Date, bool IsOpenToday, string Summary, IReadOnlyList<OpeningIntervalViewModel> Intervals);

public sealed record BranchClosureViewModel(
    Guid Id, Guid BranchId, DateOnly StartsOn, DateOnly EndsOn, string Kind, string Reason,
    string? PartialFrom, string? PartialTo, bool IsCancelled);

public sealed record TimeIntervalViewModel(DateTimeOffset Start, DateTimeOffset End);

public sealed record StaffBranchAssignmentViewModel(Guid StaffAccountId, IReadOnlyList<Guid> BranchIds, Guid PrimaryBranchId);
