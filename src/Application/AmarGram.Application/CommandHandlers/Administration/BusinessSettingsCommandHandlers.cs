using AmarGram.Application.Commands.Administration;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Administration;

/// <summary>§11.4 (C10): branch exists when scoped; load-or-create the scope's aggregate.</summary>
public sealed class ChangeBusinessSettingsCommandHandler(
    IAggregateRootRepository<BusinessSettingsAggregate> settingsRepository,
    IAggregateRootRepository<BranchAggregate> branchRepository)
    : ICommandHandlerAsync<ChangeBusinessSettingsCommand>
{
    public async Task<CommandResponse> HandleAsync(ChangeBusinessSettingsCommand command)
    {
        var scopeId = command.BranchId ?? SettingScopes.GlobalId;

        if (command.BranchId is { } branchId && !await branchRepository.ExistAsync(b => b.Id == branchId))
            return CreateBranchCommandHandler.Violation(BusinessViolationCodes.BranchNotFound, nameof(command.BranchId), "Branch not found.");

        var settings = await settingsRepository.GetByIdAsync(scopeId);
        var isNew = settings is null;
        settings ??= new BusinessSettingsAggregate(scopeId);
        if (isNew) settings.Open(command.UserContext);

        try
        {
            settings.Change(command.ToDomainDto());
        }
        catch (DomainRuleViolationException ex)
        {
            return CreateBranchCommandHandler.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        if (isNew) await settingsRepository.SaveAsync(settings, EventPublishOption.InMemoryPublishOnly);
        else await settingsRepository.UpdateAsync(settings, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = settings.Id };
    }
}

public sealed class ClearBranchSettingOverrideCommandHandler(IAggregateRootRepository<BusinessSettingsAggregate> settingsRepository)
    : ICommandHandlerAsync<ClearBranchSettingOverrideCommand>
{
    public async Task<CommandResponse> HandleAsync(ClearBranchSettingOverrideCommand command)
    {
        var settings = await settingsRepository.GetByIdAsync(command.BranchId);
        if (settings is null) return new CommandResponse { IsSuccess = true, Result = command.BranchId };

        settings.ClearOverride(command.ToDomainDto());

        await settingsRepository.UpdateAsync(settings, EventPublishOption.InMemoryPublishOnly);
        return new CommandResponse { IsSuccess = true, Result = settings.Id };
    }
}
