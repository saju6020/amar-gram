using CatEcommerce.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace CatEcommerce.Api.Hosting;

/// <summary>
/// Owner decision, 2026-09-27 (ACCEPTANCE gate A22). Validates
/// <see cref="PublicSiteOptions.WebBaseUrl"/> at real host startup -- the same
/// <see cref="IHostedService"/> pattern <c>AccountStartupGuardHostedService</c>
/// (<c>AccountsModule.cs</c>) already uses for an environment-conditional check a plain
/// DataAnnotation cannot express: resolves <see cref="IHostEnvironment"/> via DI rather than a raw
/// "ASPNETCORE_ENVIRONMENT" configuration key, which does not reflect
/// <c>IWebHostBuilder.UseEnvironment(...)</c> as used by <c>WebApplicationFactory</c> in tests.
/// Moved here from the retired module that first registered it (HO-P1); registered by <c>NotificationsModule</c>.
/// </summary>
internal sealed class PublicSiteStartupGuardHostedService(
    IHostEnvironment environment,
    IOptions<PublicSiteOptions> options,
    ILogger<PublicSiteStartupGuardHostedService> logger)
    : IHostedService
{
    // Obvious "fill me in" markers left in a copied settings file. Deliberately narrow: hosts such
    // as example.com are legitimate values here (tests and demos use them).
    private static readonly string[] PlaceholderMarkers =
        ["<", ">", "{", "}", "changeme", "change-me", "todo", "yourdomain", "your-domain", "your_domain"];

    internal static bool LooksLikePlaceholder(string value)
        => PlaceholderMarkers.Any(marker => value.Contains(marker, StringComparison.OrdinalIgnoreCase));

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var webBaseUrl = options.Value.WebBaseUrl;
        var isTesting = environment.EnvironmentName == "Testing";

        // NTF backlog #7: an empty or placeholder base URL makes every reset/care/unsubscribe link
        // built from it relative and broken. Production refuses to start; every other environment
        // keeps starting (Development and Testing legitimately run without one) but says so.
        var isEmpty = string.IsNullOrWhiteSpace(webBaseUrl);
        if (isEmpty || LooksLikePlaceholder(webBaseUrl))
        {
            var problem = isEmpty ? "is empty" : "looks like a placeholder";
            if (environment.IsProduction())
                throw new InvalidOperationException(isEmpty
                    ? "PublicSite:WebBaseUrl is required in Production."
                    : "PublicSite:WebBaseUrl looks like a placeholder; set the real public web address in Production.");

            logger.LogWarning(
                "PublicSite:WebBaseUrl {Problem} in the {Environment} environment: links in notifications "
                + "(password reset, unsubscribe) will be relative and will not work. "
                + "Set it to the site's public https address.",
                problem, environment.EnvironmentName);
            return Task.CompletedTask;
        }

        if (!Uri.TryCreate(webBaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException("PublicSite:WebBaseUrl must be an absolute http(s) URL.");

        if (uri.AbsolutePath != "/" || uri.Query.Length > 0 || uri.Fragment.Length > 0)
            throw new InvalidOperationException("PublicSite:WebBaseUrl must not include a path, query or fragment.");

        // CODE_REVIEW gate, MEDIUM (2026-09-27, fifth pass): Uri.TryCreate happily parses
        // "https://evil.example@trusted.example" as host "trusted.example" with UserInfo
        // "evil.example" -- a browser (and most humans) read the userinfo-prefixed string as the
        // domain, so a link built from this value would be phishing-shaped even though the URI class
        // considers it well-formed. Reject any non-empty userinfo alongside path/query/fragment.
        if (uri.UserInfo.Length > 0)
            throw new InvalidOperationException("PublicSite:WebBaseUrl must not include userinfo (a \"user@\" prefix).");

        if (!environment.IsDevelopment() && !isTesting && uri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("PublicSite:WebBaseUrl must use https outside Development/Testing.");

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
