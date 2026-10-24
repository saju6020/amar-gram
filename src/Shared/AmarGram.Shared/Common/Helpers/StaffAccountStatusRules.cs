using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Helpers;

/// <summary>
/// HO-P4 BG-22. One function for the staff-account status, so the list read and any later caller cannot disagree: no password yet is
/// <c>NotSetUp</c>; a password but a sign-in lockout still running at <paramref name="asOf"/> is <c>Locked</c> (the same
/// <c>LockedUntil &gt; asOf</c> test <c>LoginThrottle.IsLocked</c> makes); otherwise <c>Active</c>.
/// </summary>
public static class StaffAccountStatusRules
{
    public static StaffAccountStatus Derive(bool hasPassword, DateTimeOffset? lockedUntil, DateTimeOffset asOf)
    {
        if (!hasPassword) return StaffAccountStatus.NotSetUp;
        return lockedUntil is not null && asOf < lockedUntil ? StaffAccountStatus.Locked : StaffAccountStatus.Active;
    }
}
