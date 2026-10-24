namespace AmarGram.Read.ViewModels;

/// <summary>HO-P4 BG-22: <paramref name="Status"/> is Active, NotSetUp or Locked; <paramref name="Branches"/> lists the assigned branches, the
/// primary first then by name (empty when the person has no explicit assignment).</summary>
public sealed record StaffAccountSummaryViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress,
    IReadOnlyList<string> RoleIds, bool HasPassword, string Status, IReadOnlyList<StaffAccountBranchViewModel> Branches);

public sealed record StaffAccountBranchViewModel(Guid Id, string Name, bool IsPrimary);

public sealed record StaffAccountViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress,
    IReadOnlyList<string> RoleIds, bool HasPassword);
