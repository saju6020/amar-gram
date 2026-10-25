using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Account;
using AmarGram.Application.Commands.Account;
using AmarGram.Read.Queries.Account;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>HO-ACC-001 §12.4 / US-ACC-10 / US-ACC-11.</summary>
[ApiController]
[Route("api/staff/customers")]
public sealed class StaffCustomersController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpPost]
    [RequireAction(Actions.Customers.RegisterWalkIn)]
    public async Task<IActionResult> RegisterWalkIn([FromBody] RegisterWalkInCustomerRequest request)
    {
        var customerId = Guid.NewGuid();
        var command = new RegisterWalkInCustomerCommand
        {
            CustomerId = customerId,
            FullName = request.FullName,
            MobileNumber = request.MobileNumber,
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid(),
            ValidateCommand = true
        };

        var response = await dispatcher.SendAsync(command);

        return response.IsSuccess ? StatusCode(201, new { customerId }) : BadRequest(response.ValidationResult);
    }

    [HttpGet]
    [RequireAction(Actions.Customers.View)]
    public async Task<IActionResult> Find([FromQuery] string? mobile, [FromQuery] string? email)
    {
        var response = await dispatcher.GetResultAsync(new FindCustomersQuery
        {
            Mobile = mobile,
            Email = email,
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid()
        });

        return Ok(response.Result);
    }

    /// <summary>HO-P4 BG-19 -- the browsable, paged list of active customers. <c>search</c> matches name, email (a term with '@') or mobile (a term
    /// with three or more digits); <c>tag</c> filters to one tag; <c>sort</c> is <c>recent</c> (default) or <c>name</c>.</summary>
    [HttpGet("browse")]
    [RequireAction(Actions.Customers.View)]
    public async Task<IActionResult> Browse(
        [FromQuery] string? search, [FromQuery] string? tag, [FromQuery] string? sort, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        if (pageNumber is > PagingRules.MaxPageNumber) return BadRequest(new { error = $"pageNumber cannot exceed {PagingRules.MaxPageNumber}." });
        if (pageSize is > PagingRules.MaxPageSize) return BadRequest(new { error = $"pageSize cannot exceed {PagingRules.MaxPageSize}." });
        if (!CustomerListSorts.IsKnown(sort)) return BadRequest(new { error = "sort must be 'recent' or 'name'." });
        if (search is { Length: > 100 } || tag is { Length: > 100 }) return BadRequest(new { error = "search and tag cannot exceed 100 characters." });

        var query = new BrowseCustomersQuery
        {
            Search = search, Tag = tag, Sort = sort ?? CustomerListSorts.Recent,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid()
        };
        if (pageNumber is > 0) query.PageNumber = pageNumber.Value;
        if (pageSize is > 0) query.PageSize = pageSize.Value;

        var response = await dispatcher.GetResultAsync(query);
        return Ok(response.Result);
    }

    [HttpGet("duplicates")]
    [RequireAction(Actions.Customers.Merge)]
    public async Task<IActionResult> GetDuplicates([FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        // Integrator fix 2026-09-26 (HO-ADM-001-SECURITY's carried line: "HO-ACC-001:
        // GET /api/staff-accounts?pageNumber=2147483647 -> 500 (the Skip overflow)"; this sibling
        // endpoint shares the exact same gap): (pageNumber-1)*pageSize can overflow int (Skip
        // overflow) for a very large caller-supplied pageNumber/pageSize -- the same class of gap
        // AdminLeaveRequestsController already closed with the shared PagingRules cap, applied here
        // the same way.
        if (pageNumber is > PagingRules.MaxPageNumber) return BadRequest(new { error = $"pageNumber cannot exceed {PagingRules.MaxPageNumber}." });
        if (pageSize is > PagingRules.MaxPageSize) return BadRequest(new { error = $"pageSize cannot exceed {PagingRules.MaxPageSize}." });

        var query = new GetDuplicateCustomerGroupsQuery
        {
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid()
        };
        if (pageNumber is > 0) query.PageNumber = pageNumber.Value;
        if (pageSize is > 0) query.PageSize = pageSize.Value;

        var response = await dispatcher.GetResultAsync(query);
        return Ok(response.Result);
    }

    [HttpGet("{customerId:guid}")]
    [RequireAction(Actions.Customers.View)]
    public async Task<IActionResult> GetCustomer(Guid customerId)
    {
        var response = await dispatcher.GetResultAsync(new GetStaffCustomerQuery
        {
            CustomerId = customerId,
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid()
        });

        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    /// <summary>HO-P4 BG-19 -- the customer's staff notes, newest first.</summary>
    [HttpGet("{customerId:guid}/notes")]
    [RequireAction(Actions.Customers.View)]
    public async Task<IActionResult> GetNotes(Guid customerId)
    {
        var response = await dispatcher.GetResultAsync(new GetCustomerNotesQuery
        {
            CustomerId = customerId, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid()
        });

        return Ok(response.Result);
    }

    /// <summary>HO-P4 BG-19 -- add a staff note; the author is the signed-in staff member. 201 <c>{ noteId }</c>.</summary>
    [HttpPost("{customerId:guid}/notes")]
    [RequireAction(Actions.Customers.AddNote)]
    public async Task<IActionResult> AddNote(Guid customerId, [FromBody] AddCustomerNoteRequest request)
    {
        var noteId = Guid.NewGuid();
        var response = await dispatcher.SendAsync(new AddCustomerNoteCommand
        {
            CustomerId = customerId, NoteId = noteId, Text = request.Text ?? string.Empty,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return response.IsSuccess ? StatusCode(201, new { noteId }) : BadRequest(response.ValidationResult);
    }

    /// <summary>HO-P4 BG-19 -- replace the customer's tag set. 200 <c>{ tags }</c> as stored (trimmed, de-duplicated).</summary>
    [HttpPut("{customerId:guid}/tags")]
    [RequireAction(Actions.Customers.SetTags)]
    public async Task<IActionResult> SetTags(Guid customerId, [FromBody] SetCustomerTagsRequest request)
    {
        var response = await dispatcher.SendAsync(new SetCustomerTagsCommand
        {
            CustomerId = customerId, Tags = request.Tags ?? [],
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return response.IsSuccess ? Ok(response.Result) : BadRequest(response.ValidationResult);
    }

    /// <summary>HO-P4 BG-19 -- start a password reset for the customer. The link goes to the customer's own mobile (else email); the response says
    /// which channel and a masked destination, never the token. 200 <c>{ channel, maskedDestination, expiresOn }</c>.</summary>
    [HttpPost("{customerId:guid}/password-reset")]
    [RequireAction(Actions.Customers.RequestPasswordReset)]
    public async Task<IActionResult> RequestPasswordReset(Guid customerId)
    {
        var response = await dispatcher.SendAsync(new RequestCustomerPasswordResetCommand
        {
            CustomerId = customerId, TokenId = Guid.NewGuid(),
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });

        return response.IsSuccess ? Ok(response.Result) : BadRequest(response.ValidationResult);
    }

    [HttpPost("{duplicateId:guid}/merge")]
    [RequireAction(Actions.Customers.Merge)]
    public async Task<IActionResult> Merge(Guid duplicateId, [FromBody] MergeCustomerRequest request)
    {
        var command = new MergeCustomerCommand
        {
            DuplicateCustomerId = duplicateId,
            SurvivingCustomerId = request.SurvivingCustomerId,
            Reason = request.Reason,
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid(),
            ValidateCommand = true
        };

        var response = await dispatcher.SendAsync(command);

        return response.IsSuccess ? Ok(response.Result) : BadRequest(response.ValidationResult);
    }
}
