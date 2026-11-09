using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Billing;
using AmarGram.Application.Commands.Billing;
using AmarGram.Read.Queries.Billing;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>HO-BIL-001 §12.4 -- the seller's legal identity per branch (NFR-LEG-3), copied onto every
/// invoice at issue.</summary>
[ApiController]
[Route("api/admin/billing-profiles")]
public sealed class AdminBillingProfilesController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet("{branchId:guid}")]
    [RequireAction(Actions.Billing.View)]
    public async Task<IActionResult> Get(Guid branchId)
    {
        var response = await dispatcher.GetResultAsync(new GetBillingProfileQuery { BranchId = branchId, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    [HttpPut("{branchId:guid}")]
    [RequireAction(Actions.BillingProfile.Manage)]
    public async Task<IActionResult> Set(Guid branchId, [FromBody] SetBillingProfileRequest request)
    {
        var command = new SetBillingProfileCommand
        {
            BranchId = branchId, LegalName = request.LegalName, TaxRegistrationNumber = request.TaxRegistrationNumber,
            AddressLines = request.AddressLines, Phone = request.Phone, Email = request.Email, InvoiceFooter = request.InvoiceFooter,
            BankAccounts = request.BankAccounts,
            UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        };

        var response = await dispatcher.SendAsync(command);
        if (response.IsSuccess) return NoContent();

        var codes = response.ValidationResult?.Errors.Select(e => e.ErrorCode).ToHashSet(StringComparer.Ordinal) ?? [];
        return codes.Contains(BusinessViolationCodes.BranchNotFound) ? NotFound() : BadRequest(response.ValidationResult);
    }
}
