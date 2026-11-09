namespace AmarGram.Infrastructure.Configuration;

/// <summary>
/// Bound from appsettings.json section "PublicSite". Owner decision, 2026-09-27 (ACCEPTANCE gate
/// A22): the ONE shared public web address used to build absolute links back into the site
/// (every notification link).
///
/// Distinct from <c>AccountOptions.WebBaseUrl</c>, which is documented as "Development-only reset
/// link base URL -- never used outside Development" -- this one is required in Production.
///
/// Validated at real host startup by <c>PublicSiteStartupGuardHostedService</c>
/// (<c>Api/Hosting</c>), not by a plain DataAnnotation: the rule depends on
/// <c>IHostEnvironment</c> ("required in Production"; "https required outside
/// Development/Testing"), which a <c>[Required]</c>/<c>[Url]</c> attribute cannot see.
/// </summary>
public sealed class PublicSiteOptions
{
    public const string SectionName = "PublicSite";

    /// <summary>
    /// An absolute http(s) URL with no path, query or fragment (e.g. "https://example.com", not
    /// "https://example.com/shop" or "https://example.com?x=1") -- validated whenever a value is
    /// present, in every environment. Required (non-empty) in Production. https is required
    /// whenever a value is present outside Development/Testing. May be empty in Development or
    /// Testing; in Testing an individual test factory sets it explicitly when the test needs an
    /// absolute URL (e.g. to assert the exact link target); links built from an
    /// empty value are relative, so leaving it empty does not break every other test or a
    /// developer's own local run.
    /// </summary>
    public string WebBaseUrl { get; set; } = "";
}
