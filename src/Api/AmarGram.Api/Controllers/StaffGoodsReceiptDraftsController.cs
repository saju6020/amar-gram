using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Inventory;
using AmarGram.Application.CommandHandlers.Inventory;
using AmarGram.Application.Commands.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Read.Queries.Inventory;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>
/// HO-P4 BG-18 -- server-side goods-receipt drafts: the receiving form saved as the staff member types, so it survives a closed tab or a change of device.
/// Everything here is the CALLER'S OWN workspace (<c>Stock.Receive</c>): another staff member's draft answers 404, exactly like an unknown id. The
/// client mints the draft id and <c>PUT</c>s the whole form to it on every pause (idempotent); posting the receipt (<c>POST /api/staff/inventory/goods-receipts</c>
/// with <c>draftId</c>) or <c>DELETE</c> closes the draft, and a closed draft can never be saved again (404), so a late autosave cannot revive it.
/// Nothing in a draft is validated against the stock rules -- that happens when the receipt is posted.
/// </summary>
[ApiController]
[Route("api/staff/inventory/goods-receipt-drafts")]
public sealed class StaffGoodsReceiptDraftsController(
    IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider, IActiveBranchAccessor activeBranchAccessor) : ControllerBase
{
    /// <summary>The caller's open drafts, newest first, across every branch they work in; <c>branchId</c> narrows to one.</summary>
    [HttpGet]
    [RequireAction(Actions.Stock.Receive)]
    public async Task<IActionResult> List([FromQuery] Guid? branchId)
    {
        var user = userContextProvider.GetUserContext();
        var response = await dispatcher.GetResultAsync(new GetGoodsReceiptDraftsQuery
        { OwnerId = user.UserId, BranchId = branchId, UserContext = user, CorrelationId = Guid.NewGuid() });

        return Ok(response.Result);
    }

    [HttpGet("{id:guid}")]
    [RequireAction(Actions.Stock.Receive)]
    public async Task<IActionResult> Get(Guid id)
    {
        var user = userContextProvider.GetUserContext();
        var response = await dispatcher.GetResultAsync(new GetGoodsReceiptDraftQuery
        { DraftId = id, OwnerId = user.UserId, UserContext = user, CorrelationId = Guid.NewGuid() });

        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    /// <summary>Creates the draft with this id, or replaces its content. <c>branchId</c> in the body names the branch being received into (default: the active
    /// one); the caller must be allowed to work in it. 200 <c>{ draftId, version }</c>; 404 for another member's or a closed draft; 400
    /// <c>GoodsReceiptDraftLimitReached</c> past 20 open drafts, <c>InvalidGoodsReceiptDraft</c> for an over-long or negative field.</summary>
    [HttpPut("{id:guid}")]
    [RequireAction(Actions.Stock.Receive)]
    public async Task<IActionResult> Save(Guid id, [FromBody] SaveGoodsReceiptDraftRequest request)
    {
        if (!this.TryResolveBranch(activeBranchAccessor, request.BranchId, out var branchId, out var refusal)) return refusal!;

        var response = await dispatcher.SendAsync(new SaveGoodsReceiptDraftCommand
        {
            DraftId = id, BranchId = branchId, SupplierId = request.SupplierId, PurchaseOrderId = request.PurchaseOrderId, ConsignmentId = request.ConsignmentId,
            DeliveryReference = request.DeliveryReference, ReceivedOn = request.ReceivedOn, Note = request.Note, Lines = request.ToLines(),
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        if (!response.IsSuccess) return this.Failure(response);

        var saved = (SavedGoodsReceiptDraft)response.Result!;
        return Ok(new { draftId = saved.DraftId, version = saved.Version, branchId });
    }

    [HttpDelete("{id:guid}")]
    [RequireAction(Actions.Stock.Receive)]
    public async Task<IActionResult> Discard(Guid id)
    {
        var response = await dispatcher.SendAsync(new DiscardGoodsReceiptDraftCommand
        {
            DraftId = id, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return this.NoContentOrFailure(response);
    }
}
