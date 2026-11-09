using Platform.Infrastructure.Core.Events;

namespace AmarGram.Domain.Events.Administration;

public sealed class MaintenanceModeChangedEvent : Event
{
    public required bool MaintenanceMode { get; init; }
}
