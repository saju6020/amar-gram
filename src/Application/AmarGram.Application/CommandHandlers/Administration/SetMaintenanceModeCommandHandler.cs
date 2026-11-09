using AmarGram.Application.Commands.Administration;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Administration;

public sealed class SetMaintenanceModeCommandHandler(IAggregateRootRepository<SystemStatusAggregate> repository, TimeProvider timeProvider)
    : ICommandHandlerAsync<SetMaintenanceModeCommand>
{
    public async Task<CommandResponse> HandleAsync(SetMaintenanceModeCommand command)
    {
        var status = await repository.GetByIdAsync(SystemStatusIds.Singleton);
        var isNew = status is null;
        status ??= new SystemStatusAggregate(SystemStatusIds.Singleton);

        status.SetMaintenanceMode(command.ToDomainDto(timeProvider.GetUtcNow()));

        if (isNew) await repository.SaveAsync(status, EventPublishOption.InMemoryPublishOnly);
        else await repository.UpdateAsync(status, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true };
    }
}
