using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Api.Background;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Xunit;

namespace AmarGram.IntegrationTests;

/// <summary>HO-NTF-001 §16 -- §16.1 rules apply (fresh ids per test, never assert emptiness, never
/// TRUNCATE). Helpers mint fresh staff and customers per test, and run the notification
/// worker's passes directly (the worker loop itself is off in Testing).</summary>
public abstract class NotificationsIntegrationTestBase(NotificationsApiFactory factory)
    : AmarGramIntegrationTestBase<NotificationsApiFactory>(factory)
{
    protected override HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost/"),
        HandleCookies = true
    });

    protected static string NewMobile() => "01" + Random.Shared.NextInt64(100_000_000, 999_999_999);
    protected static string NewEmail() => $"t-{Guid.NewGuid():N}@example.test";

    /// <summary>
    /// HO-NTF-001 gate fix (2026-09-27, TEST -- SECURITY's own flakiness note on
    /// SearchByRecipient/QuietHours/UnsubscribeBeforeDelivery). A fixed HISTORICAL literal (e.g.
    /// "2026-06-16T06:00:00Z") is safely inside Asia/Dhaka daytime (UTC+6, no DST -- 02:00-15:00 UTC
    /// is 08:00-21:00 local), but because it never changes, every repeated run of the suite against
    /// this shared, persistent, never-truncated database (§16.1) writes MORE rows into the exact
    /// same instant, and a query's own <c>from</c>/<c>to</c> range around that literal stops
    /// isolating "this run's data" at all -- it isolates nothing, because every previous run's rows
    /// are in that same window too. A query with no other narrowing filter (e.g. by <c>templateKey</c>
    /// alone, paged) can then push a fresh test's own row off the first page.
    ///
    /// Returns a value anchored to the REAL current instant (so every test run gets its own,
    /// never-repeated few-minute window) but shifted, if necessary, into the same safe UTC daytime
    /// band a fixed literal would have used -- still never inside the default 21:00-08:00 Dhaka
    /// quiet-hours window, so callers that are not specifically testing quiet hours still never
    /// fall into it.
    /// </summary>
    protected static DateTimeOffset SafeDaytimeInstant()
    {
        var now = DateTimeOffset.UtcNow;
        return now.Hour is >= 2 and < 15 ? now : now.AddHours(12);
    }

    protected static string ExtractCookieValue(HttpResponseMessage response, string cookieName)
    {
        var setCookies = response.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies.ToList() : [];
        var header = setCookies.First(c => c.StartsWith(cookieName + "=", StringComparison.Ordinal));
        var rawValue = header[(cookieName.Length + 1)..].Split(';')[0];
        return Uri.UnescapeDataString(rawValue);
    }

    protected async Task<(Guid StaffAccountId, string Mobile, string Password)> SeedStaffAsync(params string[] roles)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAggregateRootRepository<StaffAccountAggregate>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var mobile = NewMobile();
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto("Test Staff", MobileNumber.Create(mobile), null, roles, new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.SaveAsync(staff, EventPublishOption.InMemoryPublishOnly);

        const string password = "staffpassword1";
        staff.SetPassword(new PasswordSetDto(hasher.Hash(password), new UserContext(Guid.NewGuid(), Guid.NewGuid()), Guid.NewGuid()));
        await repository.UpdateAsync(staff, EventPublishOption.InMemoryPublishOnly);

        return (staff.Id, mobile, password);
    }

    protected async Task<HttpClient> SignInStaffAsync(string mobile, string password)
    {
        var client = CreateClient();
        var signIn = await client.PostAsJsonAsync("/api/staff/auth/sign-in", new { identifier = mobile, password }, Json);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return client;
    }

    /// <summary>Registers and signs in a fresh customer, optionally with an email address too
    /// (added via the profile update endpoint) so preferred-channel/email-delivery tests have one.</summary>
    protected async Task<(HttpClient Client, Guid CustomerId, string Mobile)> RegisterAndSignInCustomerAsync(string? email = null)
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

        if (email is not null)
        {
            var update = await client.PutAsJsonAsync("/api/customers/me", new
            {
                fullName = "Test Customer", emailAddress = email, additionalPhoneNumbers = Array.Empty<string>(), currentPassword = password
            }, Json);
            Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);
        }

        return (client, customerId, mobile);
    }

    private static UserContext TestUserContext() => new(Guid.NewGuid(), Guid.NewGuid());

    /// <summary>Runs one delivery pass (expand pending requests, deliver due notifications, redact
    /// due secrets) in a fresh scope -- the same shape <see cref="NotificationWorkCycle"/> itself
    /// uses per item, just driven directly instead of by the (disabled) hosted worker.</summary>
    protected async Task RunDeliveryPassAsync(WebApplicationFactory<Program>? factoryOverride = null)
    {
        var services = (factoryOverride ?? Factory).Services;
        await using var scope = services.CreateAsyncScope();
        var workCycle = scope.ServiceProvider.GetRequiredService<NotificationWorkCycle>();
        await workCycle.RunDeliveryPassAsync();
    }

    /// <summary>Dispatches a <c>RequestNotificationCommand</c> directly, in a fresh scope -- there
    /// is no HTTP surface for it (§11.1 C3: "sent by timed producers ... and tests").</summary>
    protected async Task<AmarGram.Application.Commands.Notification.RequestNotificationCommand> RequestNotificationAsync(
        WebApplicationFactory<Program>? factoryOverride,
        string templateKey, NotificationRecipientKind recipientKind, Guid recipientId,
        IReadOnlyDictionary<string, string> variables, Guid? branchId = null, string? deduplicationKey = null,
        NotificationSubjectKind? subjectKind = null, Guid? subjectId = null, Guid? subjectRef = null, DateOnly? subjectDueOn = null, DateTimeOffset? notAfter = null)
    {
        var command = new AmarGram.Application.Commands.Notification.RequestNotificationCommand
        {
            RequestId = Guid.NewGuid(), TemplateKey = templateKey, RecipientKind = recipientKind.DisplayName, RecipientId = recipientId,
            Variables = variables, BranchId = branchId, DeduplicationKey = deduplicationKey,
            SubjectKind = subjectKind?.DisplayName, SubjectId = subjectId, SubjectRef = subjectRef, SubjectDueOn = subjectDueOn, NotAfter = notAfter,
            UserContext = TestUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        };

        var services = (factoryOverride ?? Factory).Services;
        await using var scope = services.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<Platform.Infrastructure.Core.IInMemoryDispatcher>();
        var response = await dispatcher.SendAsync(command);
        Assert.True(response.IsSuccess, "RequestNotificationCommand failed: " + JsonSerializer.Serialize(response.ValidationResult));

        return command;
    }

    /// <summary>Dispatches only <c>ExpandNotificationRequestCommand</c> (not the whole delivery
    /// pass) for a request that is already Pending -- lets a test observe the request expanded into
    /// a still-Queued notification, without the same pass immediately going on to deliver it too.</summary>
    protected async Task ExpandOnlyAsync(WebApplicationFactory<Program>? factoryOverride, Guid requestId)
    {
        var services = (factoryOverride ?? Factory).Services;
        await using var scope = services.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<Platform.Infrastructure.Core.IInMemoryDispatcher>();
        var response = await dispatcher.SendAsync(new AmarGram.Application.Commands.Notification.ExpandNotificationRequestCommand
        {
            RequestId = requestId, UserContext = TestUserContext(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
        });
        Assert.True(response.IsSuccess, "ExpandNotificationRequestCommand failed: " + JsonSerializer.Serialize(response.ValidationResult));
    }
}
