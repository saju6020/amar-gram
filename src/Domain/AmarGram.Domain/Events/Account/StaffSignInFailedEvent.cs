using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class StaffSignInFailedEvent : Event
{
    public required Guid AccountId { get; init; }
    public required SignInOutcome Outcome { get; init; }
    public required int ConsecutiveFailures { get; init; }
    public DateTimeOffset? LockedUntil { get; init; }
}
