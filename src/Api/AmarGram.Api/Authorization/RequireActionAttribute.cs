using Microsoft.AspNetCore.Mvc;

namespace AmarGram.Api.Authorization;

/// <summary>
/// HO-ACC-001 §12.8 / ADR-036 -- see <see cref="RequireActionFilter"/>. HO-P1 retired the optional
/// customer ownership scope.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireActionAttribute : TypeFilterAttribute
{
    public RequireActionAttribute(string action) : base(typeof(RequireActionFilter))
    {
        Arguments = [action];
    }
}
