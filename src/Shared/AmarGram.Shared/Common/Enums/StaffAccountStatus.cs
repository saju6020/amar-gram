namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// HO-P4 BG-22. Computed only (<c>StaffAccountStatusRules.Derive</c>) -- never persisted, the same way
/// <see cref="CustomerRecordStatus"/> is derived. A staff account has no "disabled" state in the aggregate (it is never deactivated, only its
/// roles change), so none is reported here; add one only together with the aggregate behaviour that sets it.
/// </summary>
public sealed class StaffAccountStatus(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly StaffAccountStatus Active = new(1, nameof(Active));
    public static readonly StaffAccountStatus NotSetUp = new(2, nameof(NotSetUp));
    public static readonly StaffAccountStatus Locked = new(3, nameof(Locked));
}
