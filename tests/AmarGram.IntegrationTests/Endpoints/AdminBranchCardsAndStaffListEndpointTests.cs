using Microsoft.Extensions.Time.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P4 BG-21 (the outlet-card details on the branch list) and BG-22 (assigned branches and status on the staff-account list).</summary>
public sealed class AdminBranchCardsAndStaffListEndpointTests(AdministrationApiFactory factory) : AdministrationIntegrationTestBase(factory)
{
    private static string NewCode() => "P" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    private static async Task<JsonElement> JsonOf(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    private async Task<Guid> CreateBranchAsync(HttpClient admin, string? type = null, string? address = "12 Lake Road, Dhaka", string timeZoneId = "Asia/Dhaka")
    {
        var create = await admin.PostAsJsonAsync("/api/admin/branches", new { code = NewCode(), name = "Card " + Guid.NewGuid().ToString("N")[..6], timeZoneId, addressLine = address, type }, Json);
        Assert.True(create.StatusCode == HttpStatusCode.Created, await create.Content.ReadAsStringAsync());
        return (await JsonOf(create)).GetProperty("branchId").GetGuid();
    }

    private static async Task<JsonElement> CardAsync(HttpClient admin, Guid branchId)
    {
        var list = await JsonOf(await admin.GetAsync("/api/admin/branches"));
        return list.EnumerateArray().Single(b => b.GetProperty("id").GetGuid() == branchId);
    }

    private static object EveryDay(string opens, string closes) => new
    {
        intervals = Enum.GetNames<DayOfWeek>().Select(d => new { dayOfWeek = d, opens, closes }).ToArray()
    };

    // ── BG-21 ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ABranchWithoutAType_IsAnOutlet_AWarehouseIsAWarehouse_AndTheTypeCanBeChanged()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var outlet = await CreateBranchAsync(client);
        var warehouse = await CreateBranchAsync(client, type: "Warehouse");

        Assert.Equal("Outlet", (await CardAsync(client, outlet)).GetProperty("type").GetString());
        Assert.Equal("Warehouse", (await CardAsync(client, warehouse)).GetProperty("type").GetString());

        var update = await client.PutAsJsonAsync($"/api/admin/branches/{outlet}", new { name = "Renamed", timeZoneId = "Asia/Dhaka", addressLine = "New address", type = "Warehouse" }, Json);
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);
        var changed = await CardAsync(client, outlet);
        Assert.Equal("Warehouse", changed.GetProperty("type").GetString());
        Assert.Equal("New address", changed.GetProperty("addressLine").GetString());

        var keep = await client.PutAsJsonAsync($"/api/admin/branches/{outlet}", new { name = "Renamed", timeZoneId = "Asia/Dhaka" }, Json); // no type: unchanged
        Assert.Equal(HttpStatusCode.NoContent, keep.StatusCode);
        Assert.Equal("Warehouse", (await CardAsync(client, outlet)).GetProperty("type").GetString());
    }

    [Fact]
    public async Task AnUnknownType_IsRefused_OnCreateAndUpdate()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var create = await client.PostAsJsonAsync("/api/admin/branches", new { code = NewCode(), name = "X", timeZoneId = "Asia/Dhaka", type = "Kiosk" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);

        var branchId = await CreateBranchAsync(client);
        var update = await client.PutAsJsonAsync($"/api/admin/branches/{branchId}", new { name = "X", timeZoneId = "Asia/Dhaka", type = "Kiosk" }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
    }

    [Fact]
    public async Task TheCard_ShowsTodaysHours_OrClosedWhenNoneAreSet()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var branchId = await CreateBranchAsync(client);

        var closed = (await CardAsync(client, branchId)).GetProperty("todayHours");
        Assert.False(closed.GetProperty("isOpenToday").GetBoolean());
        Assert.Equal("Closed", closed.GetProperty("summary").GetString());
        Assert.Empty(closed.GetProperty("intervals").EnumerateArray());

        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/admin/branches/{branchId}/hours", EveryDay("09:00", "18:00"), Json)).StatusCode);

        var open = (await CardAsync(client, branchId)).GetProperty("todayHours");
        Assert.True(open.GetProperty("isOpenToday").GetBoolean());
        Assert.Equal("09:00-18:00", open.GetProperty("summary").GetString());
        var interval = Assert.Single(open.GetProperty("intervals").EnumerateArray());
        Assert.Equal(("09:00", "18:00"), (interval.GetProperty("opens").GetString(), interval.GetProperty("closes").GetString()));
        Assert.Equal(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka")).Date,
            open.GetProperty("date").GetDateTime().Date);
    }

    [Fact]
    public async Task AFullDayClosureToday_MakesTheCardSayClosed()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var branchId = await CreateBranchAsync(client);
        await client.PutAsJsonAsync($"/api/admin/branches/{branchId}/hours", EveryDay("09:00", "18:00"), Json);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka")).DateTime);

        var closure = await client.PostAsJsonAsync($"/api/admin/branches/{branchId}/closures", new
        { startsOn = today.ToString("yyyy-MM-dd"), endsOn = today.ToString("yyyy-MM-dd"), kind = "PublicHoliday", reason = "Holiday" }, Json);
        Assert.True(closure.StatusCode == HttpStatusCode.Created, await closure.Content.ReadAsStringAsync());

        var hours = (await CardAsync(client, branchId)).GetProperty("todayHours");
        Assert.Equal("Closed", hours.GetProperty("summary").GetString());
    }

    [Fact]
    public async Task TheCard_ListsOnlyTheActiveZonesOfThatBranch_AndCountsItsAssignedStaff()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var branchId = await CreateBranchAsync(client);
        var otherBranch = await CreateBranchAsync(client);
        client.DefaultRequestHeaders.Add(AmarGram.Api.Branches.HttpContextActiveBranchAccessor.BranchHeaderName, branchId.ToString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/admin/staff/{admin.StaffAccountId}/branches", new { branchIds = new[] { branchId }, primaryBranchId = branchId }, Json)).StatusCode);

        object Zone(Guid branch, string name, int priority, bool active) => new
        {
            branchId = branch, name, priority, isActive = active, codEnabled = false, codMaxOrderValue = (decimal?)null,
            coverage = new[] { new { district = "Dist" + Guid.NewGuid().ToString("N")[..6], postalCodes = Array.Empty<string>() } },
            services = new object[] { new { serviceLevel = "Standard", isActive = true, baseCharge = 60m, freeOverOrderValue = (decimal?)null, leadTimeDays = 1, weightBands = Array.Empty<object>(), slotWindows = Array.Empty<object>() } },
        };

        var suffix = Guid.NewGuid().ToString("N")[..5];
        foreach (var (branch, name, priority, active) in new[]
                 { (branchId, "Zeta " + suffix, 2, true), (branchId, "Alpha " + suffix, 1, true), (branchId, "Retired " + suffix, 3, false), (otherBranch, "Elsewhere " + suffix, 1, true) })
        {
            var created = await client.PostAsJsonAsync("/api/admin/delivery-zones", Zone(branch, name, priority, active), Json);
            Assert.True(created.StatusCode == HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        }

        var card = await CardAsync(client, branchId);

        Assert.Equal(["Alpha " + suffix, "Zeta " + suffix], card.GetProperty("deliveryAreas").EnumerateArray().Select(a => a.GetString())); // by priority
        Assert.Equal(1, card.GetProperty("activeStaffCount").GetInt32());
        Assert.Equal(0, (await CardAsync(client, otherBranch)).GetProperty("activeStaffCount").GetInt32());
        Assert.Equal(["Elsewhere " + suffix], (await CardAsync(client, otherBranch)).GetProperty("deliveryAreas").EnumerateArray().Select(a => a.GetString()));

        var second = await SeedStaffAsync(StaffRoles.Reception);
        await client.PutAsJsonAsync($"/api/admin/staff/{second.StaffAccountId}/branches", new { branchIds = new[] { branchId, otherBranch }, primaryBranchId = otherBranch }, Json);
        Assert.Equal(2, (await CardAsync(client, branchId)).GetProperty("activeStaffCount").GetInt32());
        Assert.Equal(1, (await CardAsync(client, otherBranch)).GetProperty("activeStaffCount").GetInt32());
    }

    [Fact]
    public async Task TheDetail_CarriesTheSameCardFields()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var branchId = await CreateBranchAsync(client, type: "Warehouse");

        var detail = await JsonOf(await client.GetAsync($"/api/admin/branches/{branchId}"));

        Assert.Equal("Warehouse", detail.GetProperty("type").GetString());
        Assert.Equal("12 Lake Road, Dhaka", detail.GetProperty("addressLine").GetString());
        Assert.Equal("Closed", detail.GetProperty("todayHours").GetProperty("summary").GetString());
        Assert.Equal(JsonValueKind.Array, detail.GetProperty("deliveryAreas").ValueKind);
        Assert.Equal(0, detail.GetProperty("activeStaffCount").GetInt32());
    }

    // ── BG-22 ────────────────────────────────────────────────────────────────────────────────────

    private async Task<JsonElement> StaffRowAsync(HttpClient admin, Guid staffId, string name)
    {
        // Search by the account's own unique name, then page until it turns up: the shared database holds many pages of identically named staff (README §16.1), and a bare scan races the other tests' inserts.
        for (var pageNumber = 1; ; pageNumber++)
        {
            var page = await JsonOf(await admin.GetAsync($"/api/staff-accounts?pageSize=100&pageNumber={pageNumber}&search={Uri.EscapeDataString(name)}"));
            var items = page.GetProperty("items").EnumerateArray().ToList();
            var row = items.Where(r => r.GetProperty("id").GetGuid() == staffId).ToList();
            if (row.Count == 1) return row[0];
            Assert.True(items.Count == 100, $"Staff account {staffId} is not in the staff list.");
        }
    }

    [Fact]
    public async Task TheStaffList_ShowsAssignedBranches_PrimaryFirst_AndAnEmptyListWhenNoneAreAssigned()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var staffName = "Row Staff " + Guid.NewGuid().ToString("N")[..8];
        var staff = await SeedNamedStaffAsync(staffName, StaffRoles.Reception);
        var a = await CreateBranchAsync(client);
        var b = await CreateBranchAsync(client);
        var c = await CreateBranchAsync(client);

        Assert.Empty((await StaffRowAsync(client, staff.StaffAccountId, staffName)).GetProperty("branches").EnumerateArray());

        // The primary is the middle one; the others come after it, by name.
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/admin/staff/{staff.StaffAccountId}/branches",
            new { branchIds = new[] { a, b, c }, primaryBranchId = b }, Json)).StatusCode);

        var branches = (await StaffRowAsync(client, staff.StaffAccountId, staffName)).GetProperty("branches").EnumerateArray().ToList();
        Assert.Equal(3, branches.Count);
        Assert.Equal(b, branches[0].GetProperty("id").GetGuid());
        Assert.True(branches[0].GetProperty("isPrimary").GetBoolean());
        Assert.All(branches.Skip(1), x => Assert.False(x.GetProperty("isPrimary").GetBoolean()));
        Assert.Equal(branches.Skip(1).Select(x => x.GetProperty("name").GetString()).OrderBy(n => n, StringComparer.OrdinalIgnoreCase),
            branches.Skip(1).Select(x => x.GetProperty("name").GetString()));
        Assert.All(branches, x => Assert.StartsWith("Card ", x.GetProperty("name").GetString()));
    }

    [Fact]
    public async Task TheStaffList_ShowsTheStatus_NotSetUp_Active_Locked()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var activeName = "Row Staff " + Guid.NewGuid().ToString("N")[..8];
        var active = await SeedNamedStaffAsync(activeName, StaffRoles.Reception);
        Assert.Equal("Active", (await StaffRowAsync(client, active.StaffAccountId, activeName)).GetProperty("status").GetString());

        // Created through the API: no password yet.
        var mobile = NewMobile();
        var newName = "Not Yet " + Guid.NewGuid().ToString("N")[..8];
        var created = await client.PostAsJsonAsync("/api/staff-accounts", new { fullName = newName, mobileNumber = mobile, roleIds = new[] { StaffRoles.Reception } }, Json);
        Assert.True(created.StatusCode == HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        var newId = (await JsonOf(created)).GetProperty("staffAccountId").GetGuid();
        var notSetUp = await StaffRowAsync(client, newId, newName);
        Assert.Equal("NotSetUp", notSetUp.GetProperty("status").GetString());
        Assert.False(notSetUp.GetProperty("hasPassword").GetBoolean());

        // Wrong passwords until the throttle locks the account. The lockout is 5 s after the third failure: on a busy machine the real clock can run past it before the list is read,
        // so these steps run on a host whose clock stands still (the lock then cannot expire between the failures and the read).
        using var frozenFactory = Factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<TimeProvider>(new FakeTimeProvider(DateTimeOffset.UtcNow))));
        HttpClient FrozenClient() => frozenFactory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost/"), HandleCookies = true });

        using var frozenAdmin = FrozenClient();
        var frozenSignIn = await frozenAdmin.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = admin.Mobile, password = admin.Password }, Json);
        Assert.Equal(HttpStatusCode.OK, frozenSignIn.StatusCode);
        frozenAdmin.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(frozenSignIn, "pc_csrf"));

        for (var i = 0; i < 4; i++)
        {
            using var attempt = FrozenClient();
            await attempt.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = active.Mobile, password = "wrong-password-" + i }, Json);
        }
        Assert.Equal("Locked", (await StaffRowAsync(frozenAdmin, active.StaffAccountId, activeName)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task TheRoleCatalogue_IsUnchanged()
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        using var client = await SignInStaffAsync(admin.Mobile, admin.Password);

        var roles = await JsonOf(await client.GetAsync("/api/staff-roles"));

        Assert.Equal(
            new[] { "Accountant", "Administrator", "Inventory", "Reception", "ShopManager" },
            roles.GetProperty("roleIds").EnumerateArray().Select(r => r.GetString()!).OrderBy(r => r, StringComparer.Ordinal));
    }
}
