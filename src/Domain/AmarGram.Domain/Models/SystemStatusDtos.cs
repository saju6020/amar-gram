using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record SetMaintenanceModeDto(
    bool MaintenanceMode, string? Message, DateTimeOffset ChangedOn, UserContext UserContext, Guid CorrelationId);
