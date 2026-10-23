using AmarGram.Api.Authorization;
using AmarGram.Read.Queries.Billing;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>HO-BIL-001 §12.4 -- configuration and reference data the screens render from (ADR-182).</summary>
[ApiController]
[Route("api/billing")]
public sealed class BillingReferenceController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet("payment-methods")]
    [RequireAction(Actions.Billing.View)]
    public async Task<IActionResult> GetPaymentMethods()
    {
        var response = await dispatcher.GetResultAsync(new GetPaymentMethodsQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(response.Result);
    }
}
