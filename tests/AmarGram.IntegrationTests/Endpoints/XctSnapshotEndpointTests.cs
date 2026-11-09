using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Api.Branches;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-XCT-001 section 16 D1 -- the offline front-desk snapshot and the ping. Each case builds its own branch under a fake clock at 10:00
/// Asia/Dhaka on the next local day. HO-P1 retired the two sections the snapshot carried, so it is issued with no sections.
/// </summary>
[Collection("XctRetention")]
public sealed class XctSnapshotEndpointTests(XctApiFactory factory) : XctIntegrationTestBase(factory)
{
    private Guid _lastStaffId;

    /// <summary>
    /// 10:00 Asia/Dhaka on the NEXT local day, derived from the real clock (gate fix 2026-10-13, TEST gate row 53). A pinned date is a time bomb: the
    /// session cookie is issued with a real-clock expiry, so a baseline in the past makes every seeding POST answer 401. The next local day is always in
    /// the future.
    /// </summary>
    private static readonly DateOnly LocalDay = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka")).DateTime).AddDays(1);
    private static readonly DateTimeOffset Baseline = new DateTimeOffset(LocalDay.ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(6)).ToUniversalTime();

    private sealed record World(
        WebApplicationFactory<Program> App, FakeTimeProvider Clock, Guid BranchId, HttpClient Admin, HttpClient Customer, Guid CustomerId, string AdminMobile, string AdminPassword);

    private static string Code() => "X" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    private async Task<World> SeedWorldAsync()
    {
        var (app, clock) = Factory.WithFakeTimeProvider(Baseline);
        var adminSeed = await SeedStaffAsync(app, StaffRoles.Administrator);
        var admin = await SignInStaffAsync(adminSeed.Mobile, adminSeed.Password, app);

        var code = Code();
        var branch = await admin.PostAsJsonAsync("/api/admin/branches", new { code, name = "Snapshot Branch " + code, timeZoneId = "Asia/Dhaka" }, Json);
        Assert.Equal(HttpStatusCode.Created, branch.StatusCode);
        var branchId = (await branch.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("branchId").GetGuid();

        var days = new[] { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync($"/api/admin/branches/{branchId}/hours",
            new { intervals = days.Select(d => new { dayOfWeek = d, opens = "00:00", closes = "23:45" }).ToArray() }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync($"/api/admin/staff/{adminSeed.StaffAccountId}/branches",
            new { branchIds = new[] { branchId }, primaryBranchId = branchId }, Json)).StatusCode);
        admin.DefaultRequestHeaders.Add(HttpContextActiveBranchAccessor.BranchHeaderName, branchId.ToString());

        var (customer, customerId, _, _) = await RegisterAndSignInCustomerAsync(app);
        return new World(app, clock, branchId, admin, customer, customerId, adminSeed.Mobile, adminSeed.Password);
    }

    /// <summary>A staff member of <paramref name="role"/> assigned to the world's branch, signed in, with the branch header set.</summary>
    private async Task<(HttpClient Client, string Mobile, string Password)> StaffAtBranchAsync(World w, string role)
    {
        var seed = await SeedStaffAsync(w.App, role);
        _lastStaffId = seed.StaffAccountId;
        Assert.Equal(HttpStatusCode.NoContent, (await w.Admin.PutAsJsonAsync($"/api/admin/staff/{seed.StaffAccountId}/branches",
            new { branchIds = new[] { w.BranchId }, primaryBranchId = w.BranchId }, Json)).StatusCode);
        var client = await SignInStaffAsync(seed.Mobile, seed.Password, w.App);
        client.DefaultRequestHeaders.Add(HttpContextActiveBranchAccessor.BranchHeaderName, w.BranchId.ToString());
        return (client, seed.Mobile, seed.Password);
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response)
    {
        Assert.True(response.StatusCode == HttpStatusCode.OK, response.StatusCode + " " + await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>(Json);
    }

    private Task<int> SnapshotAuditAsync(Guid branchId) =>
        ScalarAsync<int>("SELECT COUNT(*)::int FROM audit.audit_entry WHERE \"Action\" = 'OfflineSnapshotIssued' AND \"EntityId\" = @id", ("id", branchId));

    // I-D1, I-D9, U-D6
    [Fact]
    public async Task I_D1_TheSnapshot_IsIssuedWithNoSections_Audited_WithTheContractFieldsOnly()
    {
        var w = await SeedWorldAsync();
        var (reception, _, _) = await StaffAtBranchAsync(w, StaffRoles.Reception);

        var response = await reception.GetAsync("/api/staff/offline-snapshot");
        var body = await BodyAsync(response);

        Assert.True(response.Headers.CacheControl!.NoStore && response.Headers.CacheControl.Private);
        Assert.StartsWith("\"", response.Headers.ETag!.Tag);
        Assert.Empty(body.GetProperty("sections").EnumerateObject());
        Assert.Empty(body.GetProperty("omittedSections").EnumerateArray());
        Assert.Equal(1, body.GetProperty("schemaVersion").GetInt32());
        Assert.Equal(LocalDay.ToString("yyyy-MM-dd"), body.GetProperty("localDate").GetString());
        Assert.Equal(LocalDay.AddDays(1).ToString("yyyy-MM-dd") + "T02:00:00+06:00", body.GetProperty("validUntil").GetDateTimeOffset().ToString("yyyy-MM-ddTHH:mm:sszzz"));
        Assert.Equal(1, await SnapshotAuditAsync(w.BranchId));
        Assert.Equal(["schemaVersion", "branch", "localDate", "generatedOn", "validUntil", "staffAccountId", "idleTimeoutMinutes", "refreshAfterSeconds", "sections", "omittedSections"],
            body.EnumerateObject().Select(p => p.Name).ToList());
    }

    // I-D2
    [Fact]
    public async Task I_D2_AnUnchangedDay_Is304WithNoAudit()
    {
        var w = await SeedWorldAsync();
        var (reception, _, _) = await StaffAtBranchAsync(w, StaffRoles.Reception);

        var first = await reception.GetAsync("/api/staff/offline-snapshot");
        await BodyAsync(first);
        var etag = first.Headers.ETag!.Tag;
        Assert.Equal(1, await SnapshotAuditAsync(w.BranchId));

        w.Clock.Advance(TimeSpan.FromMinutes(3));                              // generatedOn differs, content does not
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/staff/offline-snapshot");
        request.Headers.TryAddWithoutValidation("If-None-Match", etag);
        var notModified = await reception.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotModified, notModified.StatusCode);
        Assert.Equal(1, await SnapshotAuditAsync(w.BranchId));
    }

    // I-D5
    [Fact]
    public async Task I_D5_CustomerAndAnonymousAre401_AndStaffWithoutTheActionAre403()
    {
        var w = await SeedWorldAsync();
        var (inventory, _, _) = await StaffAtBranchAsync(w, StaffRoles.Inventory);

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Customer.GetAsync("/api/staff/offline-snapshot")).StatusCode);   // a customer is authenticated: the platform answers 403 (RequireActionFilter, U-A6)
        Assert.Equal(HttpStatusCode.Unauthorized, (await NewClient(w.App).GetAsync("/api/staff/offline-snapshot")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inventory.GetAsync("/api/staff/offline-snapshot")).StatusCode);
    }

    [Fact]
    public async Task AStaffMemberWithNoBranchHeaderAndSeveralBranches_IsRefused()
    {
        var w = await SeedWorldAsync();
        var seed = await SeedStaffAsync(w.App, StaffRoles.Reception);
        var client = await SignInStaffAsync(seed.Mobile, seed.Password, w.App);

        var response = await client.GetAsync("/api/staff/offline-snapshot");

        Assert.True(response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.BadRequest, response.StatusCode.ToString());
    }

    // I-D4
    [Fact]
    public async Task I_D4_PollingTheSnapshotAndThePing_NeverKeepsAnIdleStaffSessionAlive()
    {
        var w = await SeedWorldAsync();
        var (reception, _, _) = await StaffAtBranchAsync(w, StaffRoles.Reception);
        Assert.Equal(HttpStatusCode.OK, (await reception.GetAsync("/api/staff/offline-snapshot")).StatusCode);

        for (var minute = 5; minute <= 25; minute += 5)
        {
            w.Clock.Advance(TimeSpan.FromMinutes(5));
            Assert.Equal(HttpStatusCode.NoContent, (await reception.GetAsync("/api/system/ping")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await reception.GetAsync("/api/staff/offline-snapshot")).StatusCode);
        }

        w.Clock.Advance(TimeSpan.FromMinutes(6));                              // minute 31 after the last real activity (sign-in)
        var late = await reception.GetAsync("/api/staff/offline-snapshot");

        Assert.Equal(HttpStatusCode.Unauthorized, late.StatusCode);
        Assert.Contains("session_idle_timeout", await late.Content.ReadAsStringAsync());
    }

    // I-D8
    [Fact]
    public async Task I_D8_ThePing_IsPublic_204_NoStore_NoBody_AndDoesNotMoveLastActivity()
    {
        var w = await SeedWorldAsync();
        var (reception, _, _) = await StaffAtBranchAsync(w, StaffRoles.Reception);
        var before = await ScalarAsync<DateTime>("SELECT MAX(last_activity_on) FROM account.staff_session WHERE staff_account_id = @id", ("id", _lastStaffId));

        w.Clock.Advance(TimeSpan.FromMinutes(10));
        var anonymous = await NewClient(w.App).GetAsync("/api/system/ping");
        var staff = await reception.GetAsync("/api/system/ping");

        foreach (var response in new[] { anonymous, staff })
        {
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.True(response.Headers.CacheControl!.NoStore);
            Assert.Empty(await response.Content.ReadAsByteArrayAsync());
        }

        var after = await ScalarAsync<DateTime>("SELECT MAX(last_activity_on) FROM account.staff_session WHERE staff_account_id = @id", ("id", _lastStaffId));
        Assert.Equal(before, after);
    }
}
