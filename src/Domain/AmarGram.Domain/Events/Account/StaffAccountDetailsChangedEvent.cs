using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

/// <summary>Owner, 2026-10-20: an administrator changed a staff member's name, mobile number or email address.
/// HO-ACC-001 section 11.5: the event carries ids and booleans only -- which fields changed, never the values. The
/// before/after values are recorded by the DataChange audit row written in the same transaction.</summary>
public sealed class StaffAccountDetailsChangedEvent : Event
{
    public required Guid StaffAccountId { get; init; }
    public required bool FullNameChanged { get; init; }
    public required bool MobileNumberChanged { get; init; }
    public required bool EmailAddressChanged { get; init; }
}
