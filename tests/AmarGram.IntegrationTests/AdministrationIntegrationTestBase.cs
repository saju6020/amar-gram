using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Xunit;

namespace AmarGram.IntegrationTests;

/// <summary>HO-ADM-001 §16 -- §16.1 rules apply unchanged (fresh ids per test, never assert
/// emptiness, never TRUNCATE). Helpers mint fresh staff and customers per test.</summary>
public abstract class AdministrationIntegrationTestBase(AdministrationApiFactory factory)
    : AmarGramIntegrationTestBase<AdministrationApiFactory>(factory)
{
    protected override HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost/"),
        HandleCookies = true
    });

    protected static string NewMobile() => "01" + Random.Shared.Next(3, 10) + Random.Shared.NextInt64(10_000_000, 100_000_000);

    protected static string ExtractCookieValue(HttpResponseMessage response, string cookieName)
    {
        var setCookies = response.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies.ToList() : [];
        var header = setCookies.First(c => c.StartsWith(cookieName + "=", StringComparison.Ordinal));
        var rawValue = header[(cookieName.Length + 1)..].Split(';')[0];
        return Uri.UnescapeDataString(rawValue);
    }

    /// <summary>Seeds a staff account with the given roles directly through the repository (§16.1
    /// rule 7), gives it a password, then returns credentials for a real sign-in.</summary>
    protected Task<(Guid StaffAccountId, string Mobile, string Password)> SeedStaffAsync(params string[] roles) => SeedNamedStaffAsync("Test Staff", roles);

    /// <summary>The same as <see cref="SeedStaffAsync"/> with a caller-chosen full name -- unique names let a test find its own row in the staff list (every default seed is "Test Staff").</summary>
    protected async Task<(Guid StaffAccountId, string Mobile, string Password)> SeedNamedStaffAsync(string fullName, params string[] roles)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<StaffAccountAggregate>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var mobile = NewMobile();
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto(
            fullName, MobileNumber.Create(mobile), null, roles,
            new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.SaveAsync(staff, EventPublishOption.InMemoryPublishOnly);

        const string password = "staffpassword1";
        staff.SetPassword(new PasswordSetDto(hasher.Hash(password), new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.UpdateAsync(staff, EventPublishOption.InMemoryPublishOnly);

        return (staff.Id, mobile, password);
    }

    /// <summary>Signs in as staff on a fresh client and attaches the CSRF header for subsequent
    /// unsafe requests.</summary>
    protected async Task<HttpClient> SignInStaffAsync(string mobile, string password)
    {
        var client = CreateClient();
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = mobile, password }, Json);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return client;
    }

    /// <summary>Registers and signs in a fresh customer on a fresh client (real endpoints), CSRF
    /// header attached.</summary>
    protected async Task<(HttpClient Client, Guid CustomerId, string Mobile)> RegisterAndSignInCustomerAsync()
    {
        var client = CreateClient();
        var captchaResponse = await client.PostAsync("/api/captcha", null);
        captchaResponse.EnsureSuccessStatusCode();
        var captchaBody = await captchaResponse.Content.ReadFromJsonAsync<JsonElement>(Json);
        var captchaId = captchaBody.GetProperty("captchaId").GetString()!;

        var mobile = NewMobile();
        const string password = "correcthorsebattery";

        var register = await client.PostAsJsonAsync("/api/customers", new
        {
            fullName = "Test Customer", mobileNumber = mobile, password, captchaId, captchaAnswer = "TEST1"
        }, Json);
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var registerBody = await register.Content.ReadFromJsonAsync<JsonElement>(Json);
        var customerId = registerBody.GetProperty("customerId").GetGuid();

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password }, Json);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));

        return (client, customerId, mobile);
    }
}
