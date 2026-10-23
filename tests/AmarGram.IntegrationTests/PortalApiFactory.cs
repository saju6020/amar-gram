using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace AmarGram.IntegrationTests;

/// <summary>
/// HO-POR-001 §16. Real HTTP through TestServer against this branch's own database (<c>amargram_por</c>). The factory REFUSES to
/// start unless <c>AMARGRAM_TEST_DB</c> is set to the full connection string of a database that is neither
/// <c>amargram_dev</c> nor <c>amargram_test</c> -- a Portal run must never write to a shared database by accident.
/// Both workers are off. The clock is a <see cref="FakeTimeProvider"/> that does not tick, so prices and booking windows are deterministic.
/// </summary>
public class PortalApiFactory : AmarGramApiFactory
{
    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    public PortalApiFactory()
    {
        var connection = Environment.GetEnvironmentVariable("AMARGRAM_TEST_DB");
        if (string.IsNullOrWhiteSpace(connection)
            || connection.Contains("amargram_dev", StringComparison.OrdinalIgnoreCase)
            || connection.Contains("amargram_test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "AMARGRAM_TEST_DB must be set to the full Npgsql connection string of this branch's own database (amargram_por), "
                + "never amargram_dev or amargram_test.");
    }

    protected override void ConfigureAdditionalSettings(IDictionary<string, string?> settings)
    {
        settings["Captcha:TestAnswer"] = "TEST1";
        settings["DevUser:Enabled"] = "false";
        settings["RateLimiting:CaptchaIssue:PermitLimit"] = "100000";
        settings["RateLimiting:Registration:PermitLimit"] = "100000";
        settings["RateLimiting:SignIn:PermitLimit"] = "100000";
        settings["RateLimiting:PasswordReset:PermitLimit"] = "100000";
        settings["RateLimiting:AccountSensitive:PermitLimit"] = "100000";
        settings["RateLimiting:ProfileUpdate:PermitLimit"] = "100000";

        settings["PublicSite:WebBaseUrl"] = "https://portal.example.test";
        settings["Notifications:ApiBaseUrl"] = "https://api.example.test";
        settings["Notifications:Channels:Sms:Sender"] = "Capturing";
        settings["Notifications:Channels:Email:Sender"] = "Capturing";
        settings["Notifications:Worker:Enabled"] = "false";
        settings["Notifications:Unsubscribe:PermitLimit"] = "100000";
        settings["Notifications:TemplatePreview:PermitLimit"] = "100000";

        settings["Inventory:Worker:Enabled"] = "false";
        settings["Shop:Worker:Enabled"] = "false";
    }

    protected override void ConfigureAdditionalServices(IServiceCollection services)
    {
        services.AddSingleton<TimeProvider>(Clock);
        RealClockCookieExpiry.Apply(services); // see its summary: the cookie jar uses the real clock
    }
}
