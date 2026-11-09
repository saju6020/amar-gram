using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Xunit;

namespace AmarGram.Domain.Tests.Aggregates.Notification;

/// <summary>HO-NTF-001 §15 U-A13.</summary>
public sealed class NotificationTemplateAggregateTests
{
    private static readonly NotificationTemplateDefinition Definition = NotificationTemplateCatalogue.Find(NotificationTemplateCatalogue.BillingInvoiceIssued)!;

    private static IReadOnlyList<TemplateContentInput> ValidContents(string suffix) =>
    [
        new TemplateContentInput(NotificationChannel.Sms, null, null, $"{{{{invoiceNumber}}}} {{{{totalText}}}} {{{{dueOn}}}} {{{{invoiceLink}}}} {suffix}", null),
        new TemplateContentInput(NotificationChannel.Email, "Subject", null, $"{{{{invoiceNumber}}}} {{{{totalText}}}} {{{{dueOn}}}} {{{{invoiceLink}}}} {suffix}", null),
        new TemplateContentInput(NotificationChannel.InApp, null, "Title", $"{{{{invoiceNumber}}}} {{{{totalText}}}} {{{{dueOn}}}} {suffix}", "{{invoiceLink}}"),
    ];

    [Fact]
    public void EditTwiceThenReset_VersionsIncrementThenContentsCleared()
    {
        var template = new NotificationTemplateAggregate(Guid.NewGuid());
        var actorId = Guid.NewGuid();

        template.Customise(new NotificationTemplateCustomiseDto(Definition, ValidContents("v1"), actorId, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal(1, template.ContentVersion);

        template.Edit(new NotificationTemplateCustomiseDto(Definition, ValidContents("v2"), actorId, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal(2, template.ContentVersion);
        Assert.Contains(template.Contents, c => c.Body.EndsWith("v2"));

        template.ResetToDefault(actorId, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());
        Assert.Equal(3, template.ContentVersion);
        Assert.Empty(template.Contents);
    }
}
