using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Billing;
using AmarGram.Application.Commands.Billing;
using AmarGram.Domain.DomainServices;
using AmarGram.Read.Queries.Billing;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>HO-BIL-001 §12.4 -- charges and the capture pipeline (US-BIL-02). Charges are scoped to the caller's
/// active branch; a charge of another branch is "not found" (HO-ADM-001 §8.2).</summary>
[ApiController]
[Route("api/staff/billing")]
public sealed class StaffChargesController(
    IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider, IActiveBranchAccessor activeBranchAccessor)
    : StaffBillingControllerBase(activeBranchAccessor)
{
    [HttpGet("charges")]
    [RequireAction(Actions.Billing.View)]
    public async Task<IActionResult> GetCharges(
        [FromQuery] Guid? customerId, [FromQuery] string? status, [FromQuery] string? sourceKind,
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var response = await dispatcher.GetResultAsync(new GetChargesQuery
        {
            BranchId = branchId, CustomerId = customerId, Status = status, SourceKind = sourceKind,
            PageNumber = pageNumber, PageSize = pageSize, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(),
        });

        return Ok(response.Result);
    }

    [HttpPost("charges")]
    [RequireAction(Actions.Billing.ManageCharges)]
    public async Task<IActionResult> Record([FromBody] RecordManualChargeRequest request)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var chargeId = Guid.NewGuid();
        var response = await dispatcher.SendAsync(new RecordManualChargeCommand
        {
            ChargeId = chargeId, CustomerId = request.CustomerId, BranchId = branchId,
            Description = request.Description, UnitPrice = request.UnitPrice, TaxClassId = request.TaxClassId, Quantity = request.Quantity,
            LineDiscount = request.LineDiscount, ServiceDate = request.ServiceDate, BusinessLine = request.BusinessLine,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        });

        return response.IsSuccess ? StatusCode(201, new { chargeId }) : RespondToFailure(response.ValidationResult);
    }

    [HttpPost("charges/{chargeId:guid}/void")]
    [RequireAction(Actions.Billing.ManageCharges)]
    public async Task<IActionResult> Void(Guid chargeId, [FromBody] VoidChargeRequest request)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var response = await dispatcher.SendAsync(new VoidChargeCommand
        {
            ChargeId = chargeId, BranchId = branchId, Reason = request.Reason,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        });

        return response.IsSuccess ? NoContent() : RespondToFailure(response.ValidationResult, BusinessViolationCodes.ChargeNotFound);
    }
}
