using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CatEcommerce.Shared.Common.Constants;
using Xunit;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>HO-ADM-001 §16, settings (D).
///
/// Gate fix 2026-09-26 (CODE_REVIEW seventh pass, HIGH):
/// <see cref="GetSettings_ReturnsEveryRegistryKeyWithBoundsAndEffectiveValue"/> hard-asserts the
/// ambient <c>orders.pickupCollectionDays</c> effective value is the registry default ("7"), with no
/// capture/restore of its own; <see cref="ChangeSettings_InvalidValue_NothingApplied"/> captures its
/// own before-value but is still exposed to a race across its own two round trips. Both touch the
/// exact same global, shared-database setting <c>AdminGlobalSettingsLiveEffectEndpointTests</c>'s
/// own <c>SettingResolutionOrder_...</c> test mutates. The whole class joins
/// <see cref="AdministrationGlobalSettingsCollection"/> (broadest, safest fix per the gate's own
/// wording) rather than adding capture/restore to each settings-touching test individually.</summary>
[Collection(AdministrationGlobalSettingsCollection.Name)]
public sealed class AdminCatalogueSettingsEndpointTests(AdministrationApiFactory factory) : AdministrationIntegrationTestBase(factory)
{
    [Fact]
    public async Task GetSettings_ReturnsEveryRegistryKeyWithBoundsAndEffectiveValue()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var response = await client.GetAsync("/api/admin/settings");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).EnumerateArray().ToList();

        Assert.Contains(items, s => s.GetProperty("key").GetString() == SettingKeys.SecurityStaffIdleTimeoutMinutes);
        var setting = items.First(s => s.GetProperty("key").GetString() == SettingKeys.OrdersPickupCollectionDays);
        Assert.Equal("7", setting.GetProperty("effectiveValue").GetString());
    }

    [Fact]
    public async Task ChangeSettings_InvalidValue_NothingApplied()
    {
        // Settings are global, shared state (§16.1) -- capture the value beforehand rather than
        // assuming the registry default, so this is stable however many times it (or an unrelated
        // test) has already run against this database.
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var before = await GetEffectiveValueAsync(client, SettingKeys.OrdersPickupCollectionDays);

        var response = await client.PutAsJsonAsync("/api/admin/settings", new
        {
            changes = new[]
            {
                new { key = SettingKeys.OrdersPickupCollectionDays, value = "15" },
                new { key = SettingKeys.OrdersReturnWindowDays, value = "not-a-number" }
            }
        }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        // All-or-nothing: the valid change in the same batch as an invalid one must not apply.
        var after = await GetEffectiveValueAsync(client, SettingKeys.OrdersPickupCollectionDays);
        Assert.Equal(before, after);
    }

    private async Task<string> GetEffectiveValueAsync(HttpClient client, string key)
    {
        var get = await client.GetAsync("/api/admin/settings");
        var items = (await get.Content.ReadFromJsonAsync<JsonElement>(Json)).EnumerateArray().ToList();
        return items.First(s => s.GetProperty("key").GetString() == key).GetProperty("effectiveValue").GetString()!;
    }

    [Fact]
    public async Task NonAdministratorStaff_CannotManageSettings_Returns403()
    {
        var reception = await SeedStaffAsync(StaffRoles.Reception);
        using var client = await SignInStaffAsync(reception.Mobile, reception.Password);

        var response = await client.PutAsJsonAsync("/api/admin/settings", new
        {
            changes = new[] { new { key = SettingKeys.OrdersPickupCollectionDays, value = "12" } }
        }, Json);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
