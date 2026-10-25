using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Audit;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-P4 BG-19 -- the browsable customer list, the profile summary, staff notes and tags, the staff-started password reset, and that an erased
/// customer leaks nothing through any of them. Real HTTP; every test mints its own customers (names carry a per-test marker so the shared
/// database's other rows never matter).
/// </summary>
public sealed class StaffCustomerDirectoryEndpointTests(AccountsApiFactory factory) : AccountsIntegrationTestBase(factory)
{
    private const string StaffPassword = "staffpassword1";

    private async Task<(Guid StaffId, HttpClient Client)> StaffAsync(params string[] roles)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<StaffAccountAggregate>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var mobile = NewMobile();
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto("Desk Staff", MobileNumber.Create(mobile), null, roles, new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.SaveAsync(staff, EventPublishOption.InMemoryPublishOnly);
        staff.SetPassword(new PasswordSetDto(hasher.Hash(StaffPassword), new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.UpdateAsync(staff, EventPublishOption.InMemoryPublishOnly);

        var client = CreateClient();
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = mobile, password = StaffPassword }, Json);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return (staff.Id, client);
    }

    private static string Marker() => "Zq" + Guid.NewGuid().ToString("N")[..10];

    /// <summary>Registers a self-service customer whose name contains <paramref name="marker"/>; returns an authenticated customer client.</summary>
    private async Task<(HttpClient Client, Guid CustomerId, string Mobile, string Password)> CustomerAsync(string marker, string? mobile = null)
    {
        var client = CreateClient();
        var (captchaId, answer) = await GetCaptchaAsync(client);
        mobile ??= NewMobile();
        const string password = "correcthorsebattery";

        var register = await client.PostAsJsonAsync("/api/customers", new
        { fullName = $"Directory {marker}", mobileNumber = mobile, password, captchaId, captchaAnswer = answer }, Json);
        register.EnsureSuccessStatusCode();
        var customerId = (await register.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("customerId").GetGuid();

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password }, Json);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return (client, customerId, mobile, password);
    }

    private static async Task<JsonElement> JsonOf(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    private async Task<List<JsonElement>> BrowseItemsAsync(HttpClient staff, string query)
    {
        var response = await staff.GetAsync("/api/staff/customers/browse?" + query);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonOf(response)).GetProperty("items").EnumerateArray().ToList();
    }

    // ── the list ─────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Browse_FindsACustomerByPartOfTheirName_CaseInsensitively_WithTheRowFields()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);
        var marker = Marker();
        var (_, customerId, mobile, _) = await CustomerAsync(marker);

        var items = await BrowseItemsAsync(staff, $"search={marker.ToLowerInvariant()}");

        var row = Assert.Single(items);
        Assert.Equal(customerId, row.GetProperty("id").GetGuid());
        Assert.Equal($"Directory {marker}", row.GetProperty("fullName").GetString());
        Assert.Equal("Complete", row.GetProperty("recordStatus").GetString());
        Assert.Equal("Active", row.GetProperty("status").GetString());
        Assert.True(row.GetProperty("customerSince").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-5));
        Assert.Equal(JsonValueKind.Null, row.GetProperty("area").ValueKind);
        Assert.Empty(row.GetProperty("tags").EnumerateArray());
        Assert.Contains(mobile[^6..], row.GetProperty("mobileNumber").GetString());
    }

    [Fact]
    public async Task Browse_SearchesByMobileDigits_AndByEmail()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);
        var marker = Marker();
        var (_, customerId, mobile, _) = await CustomerAsync(marker);

        var byMobile = await BrowseItemsAsync(staff, $"search={mobile[^8..]}");
        Assert.Contains(byMobile, r => r.GetProperty("id").GetGuid() == customerId);

        var none = await BrowseItemsAsync(staff, $"search={Marker()}");
        Assert.Empty(none);
    }

    [Fact]
    public async Task Browse_TheSearchTermIsNotAPattern()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);
        await CustomerAsync(Marker());

        Assert.Empty(await BrowseItemsAsync(staff, "search=" + Uri.EscapeDataString("%%%zzzNoSuchName%%%")));
        Assert.Empty(await BrowseItemsAsync(staff, "search=" + Uri.EscapeDataString("_____zzzNoSuchName")));
    }

    [Fact]
    public async Task Browse_RecentFirstByDefault_AndNameOrderOnRequest_AndItPages()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);
        var marker = Marker();
        var (_, first, _, _) = await CustomerAsync(marker + "B");
        await Task.Delay(30);
        var (_, second, _, _) = await CustomerAsync(marker + "A");

        var recent = await BrowseItemsAsync(staff, $"search={marker}");
        Assert.Equal([second, first], recent.Select(r => r.GetProperty("id").GetGuid()));

        var byName = await BrowseItemsAsync(staff, $"search={marker}&sort=name");
        Assert.Equal([second, first], byName.Select(r => r.GetProperty("id").GetGuid())); // "...A" before "...B"

        var page = await staff.GetAsync($"/api/staff/customers/browse?search={marker}&pageSize=1&pageNumber=2");
        var body = await JsonOf(page);
        Assert.Equal(2, body.GetProperty("totalCount").GetInt32());
        Assert.Equal(first, Assert.Single(body.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Browse_RefusesAnUnknownSort_AndAnAbsurdPage()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);

        Assert.Equal(HttpStatusCode.BadRequest, (await staff.GetAsync("/api/staff/customers/browse?sort=spend")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.GetAsync("/api/staff/customers/browse?pageNumber=2147483647")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.GetAsync("/api/staff/customers/browse?pageSize=100000")).StatusCode);
    }

    [Fact]
    public async Task Browse_IsForStaffWhoCanViewCustomers_Only()
    {
        var (_, accountant) = await StaffAsync(StaffRoles.Accountant);
        var (customerClient, _, _, _) = await CustomerAsync(Marker());
        using var anonymous = CreateClient();

        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.GetAsync("/api/staff/customers/browse")).StatusCode);
        Assert.Contains((await customerClient.GetAsync("/api/staff/customers/browse")).StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/staff/customers/browse")).StatusCode);
    }

    // ── the profile summary ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Profile_CarriesCustomerSinceAreaOrderCountAndLifetimeSpend()
    {
        var (_, staff) = await StaffAsync(StaffRoles.Reception);
        var (customer, customerId, _, _) = await CustomerAsync(Marker());

        var before = await JsonOf(await staff.GetAsync($"/api/staff/customers/{customerId}"));
        Assert.Equal(0, before.GetProperty("orderCount").GetInt32());
        Assert.Equal("0.00", before.GetProperty("lifetimeSpend").GetProperty("amount").GetString());
        Assert.False(string.IsNullOrEmpty(before.GetProperty("lifetimeSpend").GetProperty("currencyCode").GetString()));
        Assert.Equal(JsonValueKind.Null, before.GetProperty("area").ValueKind);
        Assert.True(before.GetProperty("customerSince").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-5));
        Assert.Empty(before.GetProperty("tags").EnumerateArray());

        var add = await customer.PostAsJsonAsync("/api/customers/me/addresses", new { label = "Home", line1 = "1 Road", city = "Dhaka", district = "Gazipur" }, Json);
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);

        var after = await JsonOf(await staff.GetAsync($"/api/staff/customers/{customerId}"));
        Assert.Equal("Gazipur", after.GetProperty("area").GetString());

        var listed = Assert.Single(await BrowseItemsAsync(staff, $"search={before.GetProperty("fullName").GetString()!.Split(' ')[1]}"));
        Assert.Equal("Gazipur", listed.GetProperty("area").GetString());
    }

    // ── notes ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Notes_AreAddedAndListedNewestFirst_WithAuthorAndTime()
    {
        var (receptionId, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, customerId, _, _) = await CustomerAsync(Marker());

        var one = await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = "Prefers evening delivery" }, Json);
        Assert.Equal(HttpStatusCode.Created, one.StatusCode);
        var oneId = (await JsonOf(one)).GetProperty("noteId").GetGuid();
        await Task.Delay(20);
        await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = "Asked for a receipt copy" }, Json);

        var list = await JsonOf(await reception.GetAsync($"/api/staff/customers/{customerId}/notes"));
        var notes = list.EnumerateArray().ToList();
        Assert.Equal(2, notes.Count);
        Assert.Equal("Asked for a receipt copy", notes[0].GetProperty("text").GetString());
        Assert.Equal(oneId, notes[1].GetProperty("id").GetGuid());
        Assert.Equal(receptionId, notes[1].GetProperty("authorStaffId").GetGuid());
        Assert.Equal("Desk Staff", notes[1].GetProperty("authorName").GetString());
        Assert.True(notes[0].GetProperty("createdOn").GetDateTimeOffset() >= notes[1].GetProperty("createdOn").GetDateTimeOffset());

        var profile = await JsonOf(await reception.GetAsync($"/api/staff/customers/{customerId}"));
        Assert.Equal(2, profile.GetProperty("noteCount").GetInt32());
    }

    [Fact]
    public async Task Notes_ABlankNote_AndAnUnknownCustomer_AreRefused_AndAnAccountantCannotAdd()
    {
        var (_, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, accountant) = await StaffAsync(StaffRoles.Accountant);
        var (_, customerId, _, _) = await CustomerAsync(Marker());

        Assert.Equal(HttpStatusCode.BadRequest, (await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = "   " }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await reception.PostAsJsonAsync($"/api/staff/customers/{Guid.NewGuid()}/notes", new { text = "hi" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = "hi" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.GetAsync($"/api/staff/customers/{customerId}/notes")).StatusCode);
    }

    [Fact]
    public async Task Notes_AreAuditedByIdAndAuthor_ButTheTextNeverReachesAnAuditRow()
    {
        var (receptionId, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, customerId, _, _) = await CustomerAsync(Marker());
        var secret = "Allergic-to-" + Marker();

        var noteId = (await JsonOf(await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = secret }, Json))).GetProperty("noteId").GetGuid();

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AmarGramDbContext>();
        var business = await db.AuditEntries.AsNoTracking().Where(a => a.EntityId == customerId && a.Action == "CustomerNoteAdded").ToListAsync();

        var entry = Assert.Single(business);
        Assert.Equal(receptionId, entry.ActorUserId);
        Assert.Contains(noteId.ToString(), entry.AfterValue);

        // No audit row about this customer or its staff record, of any kind, carries the text.
        var everything = await db.AuditEntries.AsNoTracking().Where(a => a.EntityId == customerId).ToListAsync();
        Assert.DoesNotContain(everything, a => (a.BeforeValue ?? "").Contains(secret) || (a.AfterValue ?? "").Contains(secret) || a.Reason.Contains(secret));
        Assert.DoesNotContain(await db.AuditEntries.AsNoTracking().Where(a => a.EntityType.Contains("CustomerStaffRecord")).ToListAsync(), a => true);
    }

    // ── tags ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Tags_AreSetCleaned_ShownOnTheProfileAndList_AndFilterTheList()
    {
        var (_, reception) = await StaffAsync(StaffRoles.Reception);
        var marker = Marker();
        var (_, customerId, _, _) = await CustomerAsync(marker);
        var other = (await CustomerAsync(marker)).CustomerId;
        var tag = "vip" + marker[^4..];

        var put = await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = new[] { $" {tag} ", tag.ToUpperInvariant(), "Wholesale" } }, Json);
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal([tag, "Wholesale"], (await JsonOf(put)).GetProperty("tags").EnumerateArray().Select(t => t.GetString()));

        var profile = await JsonOf(await reception.GetAsync($"/api/staff/customers/{customerId}"));
        Assert.Equal([tag, "Wholesale"], profile.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));

        var filtered = await BrowseItemsAsync(reception, $"search={marker}&tag={tag}");
        Assert.Equal(customerId, Assert.Single(filtered).GetProperty("id").GetGuid());
        Assert.DoesNotContain(filtered, r => r.GetProperty("id").GetGuid() == other);
        Assert.Equal([tag, "Wholesale"], filtered[0].GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
    }

    [Fact]
    public async Task Tags_TooManyOrTooLong_AreRefused_AndAnEmptySetClears()
    {
        var (_, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, customerId, _, _) = await CustomerAsync(Marker());

        var many = await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = Enumerable.Range(0, 11).Select(i => "t" + i) }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, many.StatusCode);
        var long_ = await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = new[] { new string('x', 31) } }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, long_.StatusCode);

        await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = new[] { "VIP" } }, Json);
        var cleared = await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = Array.Empty<string>() }, Json);
        Assert.Empty((await JsonOf(cleared)).GetProperty("tags").EnumerateArray());
    }

    // ── staff-started password reset ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task PasswordReset_SendsTheCustomerTheirOwnLink_AndTheyCanFinishItAndSignIn()
    {
        var (staffId, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, customerId, mobile, oldPassword) = await CustomerAsync(Marker());

        var response = await reception.PostAsync($"/api/staff/customers/{customerId}/password-reset", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonOf(response);
        Assert.Equal("Mobile", body.GetProperty("channel").GetString());
        var masked = body.GetProperty("maskedDestination").GetString()!;
        Assert.DoesNotContain(mobile, masked);

        var dispatched = SpyPasswordResetTokenDispatcher.LastFor(customerId);
        Assert.NotNull(dispatched);
        Assert.DoesNotContain(dispatched!.PlainToken, await response.Content.ReadAsStringAsync()); // never returned to staff

        using var resetClient = CreateClient();
        const string newPassword = "a-brand-new-password-1";
        var confirm = await resetClient.PostAsJsonAsync("/api/auth/password-reset/confirm", new { token = dispatched.PlainToken, newPassword }, Json);
        Assert.Equal(HttpStatusCode.NoContent, confirm.StatusCode);

        using var signIn = CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await signIn.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password = newPassword }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient().PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password = oldPassword }, Json)).StatusCode);

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AmarGramDbContext>();
        var audit = await db.AuditEntries.AsNoTracking().SingleAsync(a => a.EntityId == customerId && a.Action == "PasswordResetRequestedByStaff");
        Assert.Equal(staffId, audit.ActorUserId);
    }

    [Fact]
    public async Task PasswordReset_UnknownCustomer_IsRefused_AnAccountantCannot_AndAnonymousIsTurnedAway()
    {
        var (_, reception) = await StaffAsync(StaffRoles.Reception);
        var (_, accountant) = await StaffAsync(StaffRoles.Accountant);
        var (_, customerId, _, _) = await CustomerAsync(Marker());
        using var anonymous = CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await reception.PostAsync($"/api/staff/customers/{Guid.NewGuid()}/password-reset", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.PostAsync($"/api/staff/customers/{customerId}/password-reset", null)).StatusCode);
        Assert.Contains((await anonymous.PostAsync($"/api/staff/customers/{customerId}/password-reset", null)).StatusCode,
            new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
    }

    // ── erasure ──────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AnErasedCustomer_LeaksNothing_NoRowNotesTagsAreaOrReset()
    {
        var (_, reception) = await StaffAsync(StaffRoles.Reception);
        var marker = Marker();
        var (customer, customerId, _, password) = await CustomerAsync(marker);
        await customer.PostAsJsonAsync("/api/customers/me/addresses", new { label = "Home", line1 = "9 Hidden Lane", city = "Dhaka", district = "Narsingdi" }, Json);
        var secret = "Gate-code-" + Marker();
        await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = secret }, Json);
        await reception.PutAsJsonAsync($"/api/staff/customers/{customerId}/tags", new { tags = new[] { "VIP" } }, Json);

        var erase = await customer.PostAsJsonAsync("/api/customers/me/deletion", new { currentPassword = password }, Json);
        Assert.True(erase.IsSuccessStatusCode, await erase.Content.ReadAsStringAsync());

        Assert.Empty(await BrowseItemsAsync(reception, $"search={marker}"));

        var profile = await JsonOf(await reception.GetAsync($"/api/staff/customers/{customerId}"));
        Assert.Equal("Anonymised", profile.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, profile.GetProperty("area").ValueKind);
        Assert.Empty(profile.GetProperty("tags").EnumerateArray());
        Assert.Equal(0, profile.GetProperty("noteCount").GetInt32());
        Assert.DoesNotContain(marker, profile.ToString());

        Assert.Empty((await JsonOf(await reception.GetAsync($"/api/staff/customers/{customerId}/notes"))).EnumerateArray());

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AmarGramDbContext>();
            Assert.Empty(await db.Set<CustomerStaffRecordAggregate>().AsNoTracking().Where(r => r.Id == customerId).SelectMany(r => r.Notes).ToListAsync());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await reception.PostAsJsonAsync($"/api/staff/customers/{customerId}/notes", new { text = "late" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await reception.PostAsync($"/api/staff/customers/{customerId}/password-reset", null)).StatusCode);
    }
}
