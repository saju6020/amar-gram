using AmarGram.Api.Authorization;
using AmarGram.Read.Queries.Account;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

[ApiController]
[Route("api/staff-roles")]
public sealed class StaffRolesController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet]
    [RequireAction(Actions.StaffAccounts.View)]
    public async Task<IActionResult> GetCatalogue()
    {
        var response = await dispatcher.GetResultAsync(new GetStaffRoleCatalogueQuery
        {
            UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid()
        });

        return Ok(response.Result);
    }
}
