using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Administration;
using AmarGram.Application.Commands.Administration;
using AmarGram.Infrastructure.Hosting;
using AmarGram.Read.Queries.Administration;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>HO-ADM-001 §12.4 -- a staff member's own leave requests.</summary>
[ApiController]
[Route("api/staff/leave-requests")]
public sealed class LeaveRequestsController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet]
    [RequireAction(Actions.Leave.Request)]
    public async Task<IActionResult> GetMine()
    {
        var caller = HttpContext.Items[ResolvedCaller.HttpContextItemsKey] as ResolvedCaller ?? ResolvedCaller.Anonymous;
        var response = await dispatcher.GetResultAsync(new GetMyLeaveRequestsQuery { StaffAccountId = caller.AccountId, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        TruncationHeader.ApplyIfAtCap(Response, response.Result.Count);
        return Ok(response.Result);
    }

    [HttpPost]
    [RequireAction(Actions.Leave.Request)]
    public async Task<IActionResult> RequestLeave([FromBody] RequestLeaveRequest request)
    {
        var leaveRequestId = Guid.NewGuid();
        var command = new RequestLeaveCommand
        {
            LeaveRequestId = leaveRequestId, StaffAccountId = null, StartsOn = request.StartsOn, EndsOn = request.EndsOn,
            Kind = request.Kind, Note = request.Note,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        };

        var response = await dispatcher.SendAsync(command);
        return response.IsSuccess ? StatusCode(201, new { leaveRequestId }) : BadRequest(response.ValidationResult);
    }

    [HttpPost("{id:guid}/cancel")]
    [RequireAction(Actions.Leave.Request)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var command = new CancelLeaveCommand
        {
            LeaveRequestId = id, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        };

        var response = await dispatcher.SendAsync(command);
        return response.IsSuccess ? NoContent() : BadRequest(response.ValidationResult);
    }
}
