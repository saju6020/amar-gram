using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record StaffSessionIdleTimeoutDto(
    DateTimeOffset AsOf,
    TimeSpan IdleTimeout,
    UserContext UserContext,
    Guid CorrelationId);
