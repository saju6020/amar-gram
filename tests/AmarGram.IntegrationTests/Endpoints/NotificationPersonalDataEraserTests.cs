using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Common.Security;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-XCT-001 §8.8 / HO-NTF-001 §13 (ARCHITECTURE HIGH 5, item 27). TEST gate, second pass,
/// 2026-09-27 -- closes the "gap left deliberately" against <c>NotificationPersonalDataEraser</c>
/// recorded on the first pass: it is registered as <c>IPersonalDataEraser</c> (§13 scope) and its
/// internal operations (<c>Redact(Anonymisation)</c>, <c>RedactVariables</c>) are proven through the
/// domain-event-handler route's own tests (<c>AnonymiseNotificationsOnCustomerAnonymisedHandler</c>),
/// but the ERASER ITSELF -- the separate, retention-worker-driven entry point (CONTRACTS.md C-ALL-2)
/// -- was never invoked by any test in this tree. These call <c>EraseAsync</c> directly.
/// </summary>
[Collection("Notifications")]
public sealed class NotificationPersonalDataEraserTests(NotificationsApiFactory factory) : NotificationsIntegrationTestBase(factory)
{
    private static UserContext Actor => new(Guid.NewGuid(), Guid.NewGuid());

    [Fact]
    public async Task EraseAsync_RedactsTheCustomersOwnNotificationAndRequest_ThenIsIdempotent()
    {
        var (_, customerId, _) = await RegisterAndSignInCustomerAsync();
        var marker = $"INVOICE-{Guid.NewGuid():N}";
        await RequestNotificationAsync(null, NotificationTemplateCatalogue.BillingInvoiceIssued, NotificationRecipientKind.Customer, customerId,
            new Dictionary<string, string> { ["invoiceNumber"] = marker, ["totalText"] = "BDT 1,500.00", ["dueOn"] = "2026-10-12", ["invoiceLink"] = "https://portal.example.test/portal/billing/invoices/x" },
            deduplicationKey: $"test:{Guid.NewGuid():N}");

        await RunDeliveryPassAsync(); // expand
        await RunDeliveryPassAsync(); // deliver -- Sent, body still carries the marker; a Normal
                                       // (non-secret) template's variables are never auto-redacted

        await using (var checkScope = Factory.Services.CreateAsyncScope())
        {
            var db = checkScope.ServiceProvider.GetRequiredService<AmarGramDbContext>();
            // Two rows share this templateKey (the external SMS/email AND the always-on InApp inbox
            // copy, §8.6) -- both belong to the same customer, so both must be redacted below.
            var beforeNotifications = await db.Set<NotificationAggregate>().AsNoTracking()
                .Where(n => n.RecipientId == customerId && n.TemplateKey == NotificationTemplateCatalogue.BillingInvoiceIssued)
                .ToListAsync();
            Assert.NotEmpty(beforeNotifications);
            Assert.All(beforeNotifications, n => Assert.Null(n.AnonymisedOn));
            Assert.Contains(beforeNotifications, n => n.Body.Contains(marker));

            var beforeRequest = await db.Set<NotificationRequestAggregate>().AsNoTracking()
                .SingleAsync(r => r.RecipientId == customerId && r.TemplateKey == NotificationTemplateCatalogue.BillingInvoiceIssued);
            Assert.Null(beforeRequest.VariablesRedactedOn);
            Assert.Contains(beforeRequest.Variables.Values, v => v == marker);
        }

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var eraser = scope.ServiceProvider.GetServices<IPersonalDataEraser>().Single(e => e.ContextKey == "notification");
            var outcome = await eraser.EraseAsync(customerId, DateTimeOffset.UtcNow, Actor, CancellationToken.None);
            Assert.IsType<ErasureOutcome.Completed>(outcome);
        }

        await using (var afterScope = Factory.Services.CreateAsyncScope())
        {
            var db = afterScope.ServiceProvider.GetRequiredService<AmarGramDbContext>();
            var afterNotifications = await db.Set<NotificationAggregate>().AsNoTracking()
                .Where(n => n.RecipientId == customerId && n.TemplateKey == NotificationTemplateCatalogue.BillingInvoiceIssued)
                .ToListAsync();
            Assert.NotEmpty(afterNotifications);
            Assert.All(afterNotifications, n => Assert.NotNull(n.AnonymisedOn));
            Assert.All(afterNotifications, n => Assert.DoesNotContain(marker, n.Body));

            var afterRequest = await db.Set<NotificationRequestAggregate>().AsNoTracking()
                .SingleAsync(r => r.RecipientId == customerId && r.TemplateKey == NotificationTemplateCatalogue.BillingInvoiceIssued);
            Assert.NotNull(afterRequest.VariablesRedactedOn);
            Assert.DoesNotContain(afterRequest.Variables.Values, v => v == marker);
        }

        // Idempotent: a second call after Completed writes nothing and still returns Completed
        // (IPersonalDataEraser's own contract, item 1).
        await using (var secondScope = Factory.Services.CreateAsyncScope())
        {
            var eraser = secondScope.ServiceProvider.GetServices<IPersonalDataEraser>().Single(e => e.ContextKey == "notification");
            var secondOutcome = await eraser.EraseAsync(customerId, DateTimeOffset.UtcNow, Actor, CancellationToken.None);
            Assert.IsType<ErasureOutcome.Completed>(secondOutcome);
        }
    }

    /// <summary>A customer this eraser has never heard of (no notification, no request) must never
    /// throw -- contract item 4.</summary>
    [Fact]
    public async Task EraseAsync_CustomerWithNoNotificationData_ReturnsCompletedWithoutThrowing()
    {
        var neverNotifiedCustomerId = Guid.NewGuid();

        await using var scope = Factory.Services.CreateAsyncScope();
        var eraser = scope.ServiceProvider.GetServices<IPersonalDataEraser>().Single(e => e.ContextKey == "notification");
        var outcome = await eraser.EraseAsync(neverNotifiedCustomerId, DateTimeOffset.UtcNow, Actor, CancellationToken.None);

        Assert.IsType<ErasureOutcome.Completed>(outcome);
    }
}
