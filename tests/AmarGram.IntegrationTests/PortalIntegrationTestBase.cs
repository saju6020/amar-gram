using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Xunit;

namespace AmarGram.IntegrationTests;

/// <summary>
/// HO-POR-001 §16.1 -- every test mints its own customers (registration with the CAPTCHA test answer) and signs in; the dashboard is
/// asserted only for that customer; upstream data is arranged through the owning modules' own endpoints or ports (administrator sessions
/// for branches, billing profiles and tax classes, Billing's charge port for invoices), never by inserting rows. No global count is asserted.
/// Helpers take an optional <c>host</c> so a test that derived a factory with <c>WithWebHostBuilder</c> (a throwing fake, captured logs) can
/// use the same arrangement code on it.
/// </summary>
public abstract class PortalIntegrationTestBase(PortalApiFactory factory)
    : AmarGramIntegrationTestBase<PortalApiFactory>(factory)
{
    protected const string StaffPassword = "staffpassword1";
    protected const string CustomerPassword = "correcthorsebattery";

    protected override HttpClient CreateClient() => ClientOn(Factory);

    protected static HttpClient ClientOn(WebApplicationFactory<Program> host) =>
        host.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost/"), HandleCookies = true });

    protected static string NewMobile() => "01" + Random.Shared.Next(3, 10) + Random.Shared.NextInt64(10_000_000, 100_000_000);

    protected static string NewCode() => "P" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    protected DateTimeOffset Now => Factory.Clock.GetUtcNow();

    protected static string ExtractCookieValue(HttpResponseMessage response, string cookieName)
    {
        var setCookies = response.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies.ToList() : [];
        var header = setCookies.First(c => c.StartsWith(cookieName + "=", StringComparison.Ordinal));
        return Uri.UnescapeDataString(header[(cookieName.Length + 1)..].Split(';')[0]);
    }

    protected static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    protected static async Task<HttpResponseMessage> ExpectAsync(HttpStatusCode expected, HttpResponseMessage response)
    {
        Assert.True(response.StatusCode == expected, $"Expected {(int)expected} but got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return response;
    }

    // ── Customers ───────────────────────────────────────────────────────────────────────────────────
    protected async Task<PortalCustomer> RegisterCustomerAsync(string fullName = "Portal Customer", WebApplicationFactory<Program>? host = null)
    {
        var client = ClientOn(host ?? Factory);
        var captcha = await client.PostAsync("/api/captcha", null);
        captcha.EnsureSuccessStatusCode();
        var captchaId = (await ReadAsync(captcha)).GetProperty("captchaId").GetString()!;

        var mobile = NewMobile();
        var register = await client.PostAsJsonAsync("/api/customers", new { fullName, mobileNumber = mobile, password = CustomerPassword, captchaId, captchaAnswer = "TEST1" }, Json);
        await ExpectAsync(HttpStatusCode.Created, register);
        var customerId = (await ReadAsync(register)).GetProperty("customerId").GetGuid();

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password = CustomerPassword }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));

        return new PortalCustomer(client, customerId, mobile, fullName);
    }

    protected sealed record PortalCustomer(HttpClient Client, Guid CustomerId, string Mobile, string FullName);

    // ── Staff ───────────────────────────────────────────────────────────────────────────────────────
    protected async Task<(Guid StaffAccountId, string Mobile, string Password)> SeedStaffAsync(params string[] roles)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<StaffAccountAggregate>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var mobile = NewMobile();
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto(
            "Portal Staff " + NewCode(), MobileNumber.Create(mobile), null, roles,
            new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.SaveAsync(staff, EventPublishOption.InMemoryPublishOnly);

        staff.SetPassword(new PasswordSetDto(hasher.Hash(StaffPassword), new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.UpdateAsync(staff, EventPublishOption.InMemoryPublishOnly);

        return (staff.Id, mobile, StaffPassword);
    }

    protected async Task<(HttpClient Client, Guid StaffAccountId)> SignInNewStaffAsync(string role, WebApplicationFactory<Program>? host = null)
    {
        var staff = await SeedStaffAsync(role);
        var client = ClientOn(host ?? Factory);
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = staff.Mobile, password = staff.Password }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return (client, staff.StaffAccountId);
    }

    // ── A branch (Administration's own admin endpoints) ─────────────────────────────────────────────
    /// <summary><see cref="Admin"/> is assigned to the branch and sends it as the active branch, so staff actions on it are allowed.</summary>
    protected sealed record BranchContext(Guid BranchId, string BranchCode, HttpClient Admin, Guid AdminStaffId);

    protected async Task<BranchContext> SeedBranchAsync()
    {
        var adminAccount = await SeedStaffAsync(StaffRoles.Administrator);
        var admin = ClientOn(Factory);
        var adminSignIn = await admin.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = adminAccount.Mobile, password = adminAccount.Password }, Json);
        await ExpectAsync(HttpStatusCode.OK, adminSignIn);
        admin.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(adminSignIn, "pc_csrf"));

        var code = NewCode();
        var createBranch = await admin.PostAsJsonAsync("/api/admin/branches", new { code, name = "Portal Branch " + code, timeZoneId = "Asia/Dhaka" }, Json);
        await ExpectAsync(HttpStatusCode.Created, createBranch);
        var branchId = (await ReadAsync(createBranch)).GetProperty("branchId").GetGuid();

        await ExpectAsync(HttpStatusCode.NoContent, await admin.PutAsJsonAsync($"/api/admin/staff/{adminAccount.StaffAccountId}/branches",
            new { branchIds = new[] { branchId }, primaryBranchId = branchId }, Json));
        admin.DefaultRequestHeaders.Add(AmarGram.Api.Branches.HttpContextActiveBranchAccessor.BranchHeaderName, branchId.ToString());

        return new BranchContext(branchId, code, admin, adminAccount.StaffAccountId);
    }

    protected async Task<HttpClient> SignInStaffOnBranchAsync(string mobile, string password, Guid branchId)
    {
        var client = ClientOn(Factory);
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = mobile, password }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        client.DefaultRequestHeaders.Add(AmarGram.Api.Branches.HttpContextActiveBranchAccessor.BranchHeaderName, branchId.ToString());
        return client;
    }

    protected async Task<HttpClient> AddStaffAsync(BranchContext branch, string role)
    {
        var staff = await SeedStaffAsync(role);
        await ExpectAsync(HttpStatusCode.NoContent, await branch.Admin.PutAsJsonAsync($"/api/admin/staff/{staff.StaffAccountId}/branches",
            new { branchIds = new[] { branch.BranchId }, primaryBranchId = branch.BranchId }, Json));
        return await SignInStaffOnBranchAsync(staff.Mobile, staff.Password, branch.BranchId);
    }

    // ── Billing (the owning module's port and staff endpoints) ──────────────────────────────────────
    /// <summary>Gives the branch a billing profile and a zero-rated tax class (a rate effective now is seeded through the
    /// repository: the admin API refuses back-dating).</summary>
    protected async Task<Guid> PrepareBillingAsync(BranchContext branch)
    {
        await ExpectAsync(HttpStatusCode.NoContent, await branch.Admin.PutAsJsonAsync($"/api/admin/billing-profiles/{branch.BranchId}", new
        {
            legalName = "Amar Gram Test Ltd " + branch.BranchCode, taxRegistrationNumber = "BIN-" + branch.BranchCode,
            addressLines = new[] { "1 Test Road", "Dhaka 1212" }, phone = "01700000000", email = "billing@example.test",
            invoiceFooter = "Thank you",
            bankAccounts = new[] { new { bankName = "Test Bank", accountName = "Amar Gram Ltd", accountNumber = "1234567890", branchName = "Gulshan", routingNumber = "012345678" } },
        }, Json));

        var taxClass = await branch.Admin.PostAsJsonAsync("/api/admin/tax-classes", new { code = NewCode(), name = "Zero " + NewCode() }, Json);
        await ExpectAsync(HttpStatusCode.Created, taxClass);
        var taxClassId = (await ReadAsync(taxClass)).GetProperty("taxClassId").GetGuid();

        await using var scope = Factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<TaxRateAggregate>>();
        var rate = new TaxRateAggregate(Guid.NewGuid());
        var effectiveFrom = Now.AddDays(-30);
        rate.Create(new TaxRateCreateDto(taxClassId, 0m, effectiveFrom, effectiveFrom.AddDays(-1), new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.SaveAsync(rate, EventPublishOption.InMemoryPublishOnly);
        return taxClassId;
    }

    /// <summary>Records one product charge through Billing's own port (what Orders will do) and issues it as an invoice through Billing's staff
    /// endpoint. Returns the invoice id.</summary>
    protected async Task<Guid> IssueInvoiceAsync(BranchContext branch, Guid taxClassId, Guid customerId, decimal amount)
    {
        var request = new AmarGram.Domain.Models.ChargeRequestDto(
            customerId, branch.BranchId, AmarGram.Shared.Common.Enums.BusinessLine.Shop,
            AmarGram.Shared.Common.Enums.ItemKind.Product, AmarGram.Shared.Common.Enums.ChargeSourceKind.Order, Guid.NewGuid(), "main",
            "Portal test item", 1m, new Money(amount, "BDT"), new Money(0m, "BDT"), taxClassId, DateOnly.FromDateTime(Now.UtcDateTime));

        Guid chargeId;
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            chargeId = await scope.ServiceProvider.GetRequiredService<IBillableChargeRecorder>().RecordAsync(request);
            await scope.ServiceProvider.GetRequiredService<AmarGramDbContext>().SaveChangesAsync();
        }

        var issue = await branch.Admin.PostAsJsonAsync("/api/staff/billing/invoices/issue-from-charges", new { customerId, selector = new { chargeIds = new[] { chargeId } } }, Json);
        await ExpectAsync(HttpStatusCode.Created, issue);
        return (await ReadAsync(issue)).GetProperty("invoiceId").GetGuid();
    }

    // ── The dashboard ───────────────────────────────────────────────────────────────────────────────
    protected static async Task<JsonElement> GetDashboardAsync(HttpClient customerClient)
    {
        var response = await customerClient.GetAsync("/api/portal/dashboard");
        await ExpectAsync(HttpStatusCode.OK, response);
        return await ReadAsync(response);
    }
}
