using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>HO-P4 BG-23 -- one roster-grid cell: Morning / Evening / Off for one person on one date, stored as roster exceptions, read back by
/// <c>roster-cells</c>, and honoured by the availability the rest of the system uses.</summary>
public sealed class AdminRosterGridCellEndpointTests(AdministrationApiFactory factory) : AdministrationIntegrationTestBase(factory)
{
    private static async Task<JsonElement> JsonOf(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    /// <summary>A date that is certainly today-or-later in Dhaka and is the given weekday.</summary>
    private static DateOnly NextWeekday(DayOfWeek day, int minDaysAhead = 3)
    {
        var d = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(minDaysAhead);
        while (d.DayOfWeek != day) d = d.AddDays(1);
        return d;
    }

    private sealed record Setup(HttpClient Admin, Guid BranchId, Guid StaffId);

    private async Task<Setup> SetupAsync(string role = StaffRoles.Reception)
    {
        var admin = await SeedStaffAsync(StaffRoles.Administrator);
        var client = await SignInStaffAsync(admin.Mobile, admin.Password);
        var staff = await SeedStaffAsync(role);

        var create = await client.PostAsJsonAsync("/api/admin/branches", new { code = "G" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(), name = "Grid", timeZoneId = "Asia/Dhaka" }, Json);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var branchId = (await JsonOf(create)).GetProperty("branchId").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/admin/staff/{staff.StaffAccountId}/branches", new { branchIds = new[] { branchId }, primaryBranchId = branchId }, Json)).StatusCode);
        return new Setup(client, branchId, staff.StaffAccountId);
    }

    private static Task<HttpResponseMessage> SetShiftAsync(Setup s, DateOnly date, string shift, Guid? staffId = null) =>
        s.Admin.PutAsJsonAsync($"/api/admin/branches/{s.BranchId}/rosters/{staffId ?? s.StaffId}/shifts/{date:yyyy-MM-dd}", new { shift }, Json);

    private static async Task<JsonElement> CellAsync(Setup s, DateOnly date)
    {
        var cells = await JsonOf(await s.Admin.GetAsync($"/api/admin/branches/{s.BranchId}/roster-cells?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&staffAccountId={s.StaffId}"));
        return Assert.Single(cells.EnumerateArray());
    }

    private static async Task<List<JsonElement>> AvailabilityAsync(Setup s, DateOnly date) =>
        (await JsonOf(await s.Admin.GetAsync($"/api/admin/branches/{s.BranchId}/availability?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&staffAccountId={s.StaffId}"))).EnumerateArray().ToList();

    [Fact]
    public async Task ClickToCycle_MorningEveningOff_EachReadsBack_AndDrivesAvailability()
    {
        var s = await SetupAsync();
        var date = NextWeekday(DayOfWeek.Wednesday);

        var morning = await SetShiftAsync(s, date, "Morning");
        Assert.Equal(HttpStatusCode.OK, morning.StatusCode);
        var cell = await JsonOf(morning);
        Assert.Equal("Morning", cell.GetProperty("shift").GetString());
        Assert.Equal(s.StaffId, cell.GetProperty("staffAccountId").GetGuid());
        Assert.Equal(date.ToString("yyyy-MM-dd"), cell.GetProperty("date").GetString());
        var slot = Assert.Single(cell.GetProperty("slots").EnumerateArray());
        Assert.Equal(("08:00", "14:00"), (slot.GetProperty("starts").GetString(), slot.GetProperty("ends").GetString()));

        var interval = Assert.Single(await AvailabilityAsync(s, date));
        Assert.Equal(TimeSpan.FromHours(6), interval.GetProperty("start").GetDateTimeOffset().Offset);
        Assert.Equal(8, interval.GetProperty("start").GetDateTimeOffset().Hour);
        Assert.Equal(14, interval.GetProperty("end").GetDateTimeOffset().Hour);

        Assert.Equal("Evening", (await JsonOf(await SetShiftAsync(s, date, "Evening"))).GetProperty("shift").GetString());
        var evening = Assert.Single(await AvailabilityAsync(s, date));
        Assert.Equal(14, evening.GetProperty("start").GetDateTimeOffset().Hour);
        Assert.Equal(20, evening.GetProperty("end").GetDateTimeOffset().Hour);

        Assert.Equal("Off", (await JsonOf(await SetShiftAsync(s, date, "Off"))).GetProperty("shift").GetString());
        Assert.Empty(await AvailabilityAsync(s, date));
        Assert.Equal("Off", (await CellAsync(s, date)).GetProperty("shift").GetString());

        // Round the cycle: Morning again re-uses the same rows.
        Assert.Equal("Morning", (await JsonOf(await SetShiftAsync(s, date, "Morning"))).GetProperty("shift").GetString());
        Assert.Single(await AvailabilityAsync(s, date));
        Assert.Equal("Morning", (await CellAsync(s, date)).GetProperty("shift").GetString());
    }

    [Fact]
    public async Task ACell_OverridesTheWeeklyPatternForThatDateOnly()
    {
        var s = await SetupAsync();
        var monday = NextWeekday(DayOfWeek.Monday);
        var nextMonday = monday.AddDays(7);
        Assert.Equal(HttpStatusCode.NoContent, (await s.Admin.PutAsJsonAsync($"/api/admin/branches/{s.BranchId}/rosters/{s.StaffId}/pattern",
            new { slots = new[] { new { dayOfWeek = "Monday", starts = "09:00", ends = "17:00" } } }, Json)).StatusCode);

        var before = await CellAsync(s, monday);
        Assert.Equal("Custom", before.GetProperty("shift").GetString()); // the pattern's own 09:00-17:00 matches neither preset

        Assert.Equal("Off", (await JsonOf(await SetShiftAsync(s, monday, "Off"))).GetProperty("shift").GetString());
        Assert.Empty(await AvailabilityAsync(s, monday));
        Assert.Single(await AvailabilityAsync(s, nextMonday)); // the pattern still applies a week later

        Assert.Equal("Evening", (await JsonOf(await SetShiftAsync(s, monday, "Evening"))).GetProperty("shift").GetString());
        var only = Assert.Single(await AvailabilityAsync(s, monday));
        Assert.Equal(14, only.GetProperty("start").GetDateTimeOffset().Hour); // not merged with the 09:00-17:00 pattern shift
    }

    [Fact]
    public async Task TheCellsRead_CoversEveryRosteredPersonAndDayOfTheRange()
    {
        var s = await SetupAsync();
        var from = NextWeekday(DayOfWeek.Monday);
        await SetShiftAsync(s, from.AddDays(1), "Evening");

        var cells = (await JsonOf(await s.Admin.GetAsync($"/api/admin/branches/{s.BranchId}/roster-cells?from={from:yyyy-MM-dd}&to={from.AddDays(6):yyyy-MM-dd}"))).EnumerateArray().ToList();

        Assert.Equal(7, cells.Count);
        Assert.Equal("Evening", cells.Single(c => c.GetProperty("date").GetString() == from.AddDays(1).ToString("yyyy-MM-dd")).GetProperty("shift").GetString());
        Assert.Equal(6, cells.Count(c => c.GetProperty("shift").GetString() == "Off"));
    }

    [Fact]
    public async Task TheCellsRead_RefusesABackwardsOrOversizedRange()
    {
        var s = await SetupAsync();
        var from = NextWeekday(DayOfWeek.Monday);

        Assert.Equal(HttpStatusCode.BadRequest, (await s.Admin.GetAsync($"/api/admin/branches/{s.BranchId}/roster-cells?from={from:yyyy-MM-dd}&to={from.AddDays(-1):yyyy-MM-dd}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await s.Admin.GetAsync($"/api/admin/branches/{s.BranchId}/roster-cells?from={from:yyyy-MM-dd}&to={from.AddDays(40):yyyy-MM-dd}")).StatusCode);
    }

    [Fact]
    public async Task APastDay_AnUnknownShift_Custom_AndANonRosterableStaffMember_AreRefused()
    {
        var s = await SetupAsync();
        var accountant = await SeedStaffAsync(StaffRoles.Accountant);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var past = await SetShiftAsync(s, today.AddDays(-2), "Morning");
        Assert.Equal(HttpStatusCode.BadRequest, past.StatusCode);
        Assert.Contains(BusinessViolationCodes.ShiftDateInPast, await past.Content.ReadAsStringAsync());

        var future = NextWeekday(DayOfWeek.Friday);
        Assert.Equal(HttpStatusCode.BadRequest, (await SetShiftAsync(s, future, "Lunch")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await SetShiftAsync(s, future, "Custom")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await SetShiftAsync(s, future, "")).StatusCode);

        var notRosterable = await SetShiftAsync(s, future, "Morning", accountant.StaffAccountId);
        Assert.Equal(HttpStatusCode.BadRequest, notRosterable.StatusCode);
        Assert.Contains(BusinessViolationCodes.StaffNotRosterable, await notRosterable.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ACellIsManagedByAdministrators_AndViewedByReception()
    {
        var s = await SetupAsync();
        var reception = await SeedStaffAsync(StaffRoles.Reception);
        using var receptionClient = await SignInStaffAsync(reception.Mobile, reception.Password);
        var date = NextWeekday(DayOfWeek.Thursday);

        var set = await receptionClient.PutAsJsonAsync($"/api/admin/branches/{s.BranchId}/rosters/{s.StaffId}/shifts/{date:yyyy-MM-dd}", new { shift = "Morning" }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, set.StatusCode);

        var read = await receptionClient.GetAsync($"/api/admin/branches/{s.BranchId}/roster-cells?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
    }

    [Fact]
    public async Task APersonNotAssignedToAMultiBranchSetup_IsRefused()
    {
        var s = await SetupAsync();
        var outsider = await SeedStaffAsync(StaffRoles.Reception);
        var date = NextWeekday(DayOfWeek.Thursday);

        var response = await SetShiftAsync(s, date, "Morning", outsider.StaffAccountId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(BusinessViolationCodes.BranchNotAssigned, await response.Content.ReadAsStringAsync());
    }
}
