using AmarGram.Application.Commands.Account;
using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Hosting;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Authorization;

/// <summary>
/// HO-ACC-001 §12.8 / ADR-036. HO-P1 retired the customer ownership scoping of HO-ADM-001 §12.3 / ADR-043.
///
/// 1. Anonymous caller -&gt; 401 <c>session_invalid</c> (no audit -- there is no identity
///    to attribute the denial to).
/// 2. Customer caller -&gt; the same 403-plus-audit path as a staff caller with no matching
///    role (U-A6) -- a customer IS authenticated, so a blanket 401 would be wrong here.
/// 3. Staff caller -&gt; role check against <see cref="ActionRoles"/> (unchanged): permitted -&gt;
///    allow; else -&gt; 403 + audit.
/// </summary>
public sealed class RequireActionFilter(
    string action,
    IInMemoryDispatcher dispatcher,
    IUserContextProvider userContextProvider,
    IClientIpAccessor clientIpAccessor,
    ILogger<RequireActionFilter> logger)
    : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var caller = context.HttpContext.Items[ResolvedCaller.HttpContextItemsKey] as ResolvedCaller ?? ResolvedCaller.Anonymous;

        if (caller.Kind == ResolvedCallerKind.Anonymous)
        {
            Unauthorized(context);
            return;
        }

        if (caller.Kind == ResolvedCallerKind.Customer)
        {
            await DenyAsync(context);
            return;
        }

        // caller.Kind == Staff
        var permitted = ActionRoles.TryGetRoles(action, out var allowedRoles) &&
                         allowedRoles.Intersect(caller.RoleIds, StringComparer.Ordinal).Any();

        if (permitted) return;

        await DenyAsync(context);
    }

    private static void Unauthorized(AuthorizationFilterContext context)
    {
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        context.Result = new ObjectResult(new { error = "session_invalid" }) { StatusCode = 401 };
    }

    private async Task DenyAsync(AuthorizationFilterContext context)
    {
        try
        {
            var command = new RecordAuthorizationDenialCommand
            {
                Action = action,
                Method = context.HttpContext.Request.Method,
                Path = context.HttpContext.Request.Path.Value ?? "",
                IpAddress = clientIpAccessor.GetClientIpAddress()?.ToString(),
                UserContext = userContextProvider.GetUserContext(),
                CorrelationId = Guid.NewGuid(),
                ValidateCommand = true
            };

            await dispatcher.SendAsync(command);
        }
        catch (Exception ex)
        {
            // Never an allow, never a 500 -- the denial itself must still be returned (§20.14).
            logger.LogError(ex, "Failed to record authorization denial for action {Action}", action);
        }

        context.Result = new ObjectResult(new
        {
            errors = new[] { new { errorCode = BusinessViolationCodes.ActionNotPermitted, errorMessage = "You are not permitted to perform this action." } }
        })
        { StatusCode = 403 };
    }
}
