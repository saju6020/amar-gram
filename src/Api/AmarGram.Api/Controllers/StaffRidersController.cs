using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Order;
using AmarGram.Api.Ordering;
using AmarGram.Application.Commands.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Read.Queries.Order;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>
/// HO-P4 BG-5 -- the branch's in-house riders. A minimal registry per branch (the staff member's <b>active</b> branch, <c>X-Branch-Id</c>): who can be dispatched to, instead of a courier.
/// Reading the list is <c>Orders.Fulfil</c> (the dispatch dialog chooses from it; <c>activeOnly=true</c>), adding and editing a rider is <c>Riders.Manage</c> (Shop Manager, Administrator).
/// A rider is deactivated, never deleted -- an order's shipment points at it.
/// </summary>
[ApiController]
[Route("api/staff/riders")]
public sealed class StaffRidersController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider, IActiveBranchAccessor activeBranchAccessor)
    : StaffOrderControllerBase(activeBranchAccessor)
{
    [HttpGet]
    [RequireAction(Actions.Orders.Fulfil)]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var response = await dispatcher.GetResultAsync(new GetRidersQuery { BranchId = branchId, ActiveOnly = activeOnly, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }

    [HttpPost]
    [RequireAction(Actions.Riders.Manage)]
    public async Task<IActionResult> Create([FromBody] RiderRequest request)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var riderId = Guid.NewGuid();
        var response = await dispatcher.SendAsync(new CreateRiderCommand
        {
            RiderId = riderId, BranchId = branchId, Name = request.Name ?? string.Empty, MobileNumber = request.MobileNumber, IsActive = request.IsActive,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return response.IsSuccess ? StatusCode(201, new { riderId }) : OrderingResults.Failure(this, response);
    }

    [HttpPut("{riderId:guid}")]
    [RequireAction(Actions.Riders.Manage)]
    public async Task<IActionResult> Update(Guid riderId, [FromBody] RiderRequest request)
    {
        if (!TryResolveBranch(out var branchId, out var refusal)) return refusal!;

        var response = await dispatcher.SendAsync(new UpdateRiderCommand
        {
            RiderId = riderId, BranchId = branchId, Name = request.Name ?? string.Empty, MobileNumber = request.MobileNumber, IsActive = request.IsActive,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return response.IsSuccess ? NoContent() : OrderingResults.Failure(this, response);
    }
}
