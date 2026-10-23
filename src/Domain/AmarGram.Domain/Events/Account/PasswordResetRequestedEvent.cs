using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class PasswordResetRequestedEvent : Event
{
    public required AccountKind AccountKind { get; init; }
    public required Guid AccountId { get; init; }
    public required PasswordResetChannel Channel { get; init; }
    public required DateTimeOffset ExpiresOn { get; init; }
}
