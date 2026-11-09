using AmarGram.Application.Commands.Administration;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Administration;

public sealed class CreateContentItemCommandHandler(IAggregateRootRepository<ContentItemAggregate> repository) : ICommandHandlerAsync<CreateContentItemCommand>
{
    public async Task<CommandResponse> HandleAsync(CreateContentItemCommand command)
    {
        if (await repository.ExistAsync(c => c.Slug == command.Slug))
            return CreateBranchCommandHandler.Violation(BusinessViolationCodes.ContentSlugAlreadyExists, nameof(command.Slug), $"Slug '{command.Slug}' is already in use.");

        var item = new ContentItemAggregate(command.ContentItemId);
        try
        {
            item.Create(command.ToDomainDto());
        }
        catch (DomainRuleViolationException ex)
        {
            return CreateBranchCommandHandler.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        await repository.SaveAsync(item, EventPublishOption.InMemoryPublishOnly);
        return new CommandResponse { IsSuccess = true, Result = item.Id };
    }
}

public sealed class EditContentDraftCommandHandler(IAggregateRootRepository<ContentItemAggregate> repository) : ICommandHandlerAsync<EditContentDraftCommand>
{
    public async Task<CommandResponse> HandleAsync(EditContentDraftCommand command)
    {
        var item = await repository.GetByIdAsync(command.ContentItemId);
        if (item is null) return CreateBranchCommandHandler.Violation(BusinessViolationCodes.ContentNotFound, nameof(command.ContentItemId), "Content item not found.");

        try
        {
            item.EditDraft(command.ToDomainDto());
        }
        catch (DomainRuleViolationException ex)
        {
            return CreateBranchCommandHandler.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        await repository.UpdateAsync(item, EventPublishOption.InMemoryPublishOnly);
        return new CommandResponse { IsSuccess = true, Result = item.Id };
    }
}

public sealed class PublishContentItemCommandHandler(IAggregateRootRepository<ContentItemAggregate> repository, TimeProvider timeProvider)
    : ICommandHandlerAsync<PublishContentItemCommand>
{
    public async Task<CommandResponse> HandleAsync(PublishContentItemCommand command)
    {
        var item = await repository.GetByIdAsync(command.ContentItemId);
        if (item is null) return CreateBranchCommandHandler.Violation(BusinessViolationCodes.ContentNotFound, nameof(command.ContentItemId), "Content item not found.");

        item.Publish(command.ToDomainDto(timeProvider.GetUtcNow()));

        await repository.UpdateAsync(item, EventPublishOption.InMemoryPublishOnly);
        return new CommandResponse { IsSuccess = true, Result = item.Id };
    }
}

public sealed class UnpublishContentItemCommandHandler(IAggregateRootRepository<ContentItemAggregate> repository) : ICommandHandlerAsync<UnpublishContentItemCommand>
{
    public async Task<CommandResponse> HandleAsync(UnpublishContentItemCommand command)
    {
        var item = await repository.GetByIdAsync(command.ContentItemId);
        if (item is null) return CreateBranchCommandHandler.Violation(BusinessViolationCodes.ContentNotFound, nameof(command.ContentItemId), "Content item not found.");

        item.Unpublish(command.ToDomainDto());

        await repository.UpdateAsync(item, EventPublishOption.InMemoryPublishOnly);
        return new CommandResponse { IsSuccess = true, Result = item.Id };
    }
}
