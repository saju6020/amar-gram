using System.Text.Json;
using System.Text.Json.Nodes;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Api.Controllers;

/// <summary>
/// HO-SUB-001 §12.4 -- how a failed Subscriptions command becomes an HTTP answer (the same shape as Ordering's). A violation that says "this record does not exist (for
/// you)" is a <c>404</c> -- the same answer as one that belongs to someone else, so a customer can never tell the two apart (ADR-248); a stale version is a <c>409</c>;
/// every other business refusal is a <c>400</c> with the usual <c>ValidationResponse</c> body (<c>errorCode</c> per error).
/// </summary>
internal static class SubscriptionHttp
{
    private static readonly HashSet<string> NotFoundCodes = [BusinessViolationCodes.SubscriptionNotFound, BusinessViolationCodes.ProductNotFound];

    private static readonly HashSet<string> ConflictCodes = [BusinessViolationCodes.StaleVersion];

    /// <summary>
    /// <c>SubscriptionView + extras</c> as ONE flat JSON object (§12.4: "<c>SubscriptionView</c> + <c>cycles</c>"), serialised with the host's own camelCase options so it is
    /// indistinguishable from a view type that carried the extra members itself.
    /// </summary>
    public static JsonObject Flatten(ControllerBase controller, object view, params (string Name, object? Value)[] extras)
    {
        var options = controller.HttpContext.RequestServices.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
        var node = JsonSerializer.SerializeToNode(view, options)!.AsObject();
        foreach (var (name, value) in extras) node[options.PropertyNamingPolicy?.ConvertName(name) ?? name] = value is null ? null : JsonSerializer.SerializeToNode(value, value.GetType(), options);
        return node;
    }

    public static IActionResult Failure(ControllerBase controller, CommandResponse response)
    {
        var codes = response.ValidationResult?.Errors.Select(e => e.ErrorCode).ToList() ?? [];

        if (codes.Any(NotFoundCodes.Contains)) return controller.NotFound();
        if (codes.Any(ConflictCodes.Contains)) return controller.Conflict(response.ValidationResult);
        return controller.BadRequest(response.ValidationResult);
    }
}
