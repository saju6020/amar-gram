using System.Text.Json;
using Xunit;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>Row 13 -- the interim availability guard is retired.</summary>
public sealed partial class ShopBacklogFixesEndpointTests
{
    // ── Row 13 (retired by HO-SHP-001-FU2): the interim availability flag is deleted ──────────────

    [Fact]
    public void Row13_TheInterimAvailabilityFlag_IsGone_FromTheShippedAppsettingsAndTheOptions()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "appsettings.json")));

        var shop = document.RootElement.GetProperty("Shop");
        Assert.False(shop.TryGetProperty("InterimAvailabilityFromPrice", out _));
        Assert.Null(typeof(CatEcommerce.Infrastructure.Configuration.ShopOptions).GetProperty("InterimAvailabilityFromPrice"));
    }
}
