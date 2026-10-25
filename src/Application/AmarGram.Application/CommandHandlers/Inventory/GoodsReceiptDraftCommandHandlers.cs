using AmarGram.Application.Commands.Inventory;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Application.CommandHandlers.Inventory;

/// <summary>What a saved draft answers: its id and the version it is now at (the autosave's heartbeat).</summary>
public sealed record SavedGoodsReceiptDraft(Guid DraftId, int Version);

/// <summary>
/// HO-P4 BG-18. Upserts the caller's draft. The draft is the owner's workspace: another staff member's draft id answers exactly like an unknown
/// one (404, never revealing it exists), a closed draft is refused so a late autosave cannot revive it, and a staff member can hold at most
/// <see cref="InventoryRules.MaxGoodsReceiptDraftsPerStaff"/> open drafts (the check runs only when a NEW draft is first saved). Nothing about the
/// receipt itself is validated here -- that is <c>PostGoodsReceiptCommand</c>'s job. The caller's right to the target branch is the controller's
/// check (the same rule as posting).
/// </summary>
public sealed class SaveGoodsReceiptDraftCommandHandler(
    ILogger<SaveGoodsReceiptDraftCommandHandler> logger,
    IAggregateRootRepository<GoodsReceiptDraftAggregate> drafts,
    IGoodsReceiptDraftCounter counter)
    : ICommandHandlerAsync<SaveGoodsReceiptDraftCommand>
{
    public async Task<CommandResponse> HandleAsync(SaveGoodsReceiptDraftCommand command)
    {
        var ownerId = command.UserContext!.UserId;
        logger.LogInformation("Saving goods-receipt draft {DraftId} with {LineCount} lines. CorrelationId: {CorrelationId}", command.DraftId, command.Lines.Count, command.CorrelationId);

        var draft = await drafts.GetByIdAsync(command.DraftId);
        var isNew = draft is null;
        if (draft is not null && draft.OwnerId != ownerId)
            return InventoryResponses.NotFound(BusinessViolationCodes.GoodsReceiptDraftNotFound, nameof(command.DraftId), "That draft was not found.");

        if (isNew)
        {
            if (await counter.CountOpenAsync(ownerId, CancellationToken.None) >= InventoryRules.MaxGoodsReceiptDraftsPerStaff)
                return InventoryResponses.Fail(BusinessViolationCodes.GoodsReceiptDraftLimitReached, nameof(command.DraftId),
                    $"You already have {InventoryRules.MaxGoodsReceiptDraftsPerStaff} open drafts. Post or discard one first.");

            draft = new GoodsReceiptDraftAggregate(command.DraftId);
        }

        try
        {
            draft!.Save(command.ToDomainDto());
        }
        catch (DomainRuleViolationException ex)
        {
            return ex.ErrorCode == BusinessViolationCodes.GoodsReceiptDraftNotFound
                ? InventoryResponses.NotFound(ex.ErrorCode, ex.PropertyName, ex.Message)
                : InventoryResponses.Fail(ex);
        }

        if (isNew) await drafts.SaveAsync(draft, EventPublishOption.InMemoryPublishOnly);
        else await drafts.UpdateAsync(draft, EventPublishOption.InMemoryPublishOnly);

        return InventoryResponses.Ok(new SavedGoodsReceiptDraft(draft.Id, draft.Version));
    }
}

/// <summary>HO-P4 BG-18. Discards the caller's draft. Unknown or another staff member's draft is a 404; an already-closed one is a success.</summary>
public sealed class DiscardGoodsReceiptDraftCommandHandler(
    ILogger<DiscardGoodsReceiptDraftCommandHandler> logger,
    IAggregateRootRepository<GoodsReceiptDraftAggregate> drafts,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<DiscardGoodsReceiptDraftCommand>
{
    public async Task<CommandResponse> HandleAsync(DiscardGoodsReceiptDraftCommand command)
    {
        logger.LogInformation("Discarding goods-receipt draft {DraftId}. CorrelationId: {CorrelationId}", command.DraftId, command.CorrelationId);

        var draft = await drafts.GetByIdAsync(command.DraftId);
        if (draft is null || draft.OwnerId != command.UserContext!.UserId)
            return InventoryResponses.NotFound(BusinessViolationCodes.GoodsReceiptDraftNotFound, nameof(command.DraftId), "That draft was not found.");

        if (!draft.IsOpen) return InventoryResponses.Ok();

        draft.Discard(command.UserContext.UserId, timeProvider.GetUtcNow());
        await drafts.UpdateAsync(draft, EventPublishOption.InMemoryPublishOnly);
        return InventoryResponses.Ok();
    }
}
