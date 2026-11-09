using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Account;

public sealed class PasswordResetRequestedEvent : Event
{
    public required AccountKind AccountKind { get; init; }
    public required Guid AccountId { get; init; }
    public required PasswordResetChannel Channel { get; init; }
    public required DateTimeOffset ExpiresOn { get; init; }
    /// <summary>HO-P4 BG-19. The staff member who started the reset on the account holder's behalf; null for a self-service request. An id, not text.</summary>
    public Guid? InitiatedByStaffId { get; init; }
}
