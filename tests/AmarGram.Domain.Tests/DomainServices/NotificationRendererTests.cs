using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Xunit;

namespace AmarGram.Domain.Tests.DomainServices;

/// <summary>HO-NTF-001 §15 U-A9..U-A11. Pure -- no database.</summary>
public sealed class NotificationRendererTests
{
    private static readonly IReadOnlyList<NotificationTemplateVariableDefinition> Variables =
    [
        new NotificationTemplateVariableDefinition("customerName", "d", TemplateVariableKind.Text, "Mitu", []),
        new NotificationTemplateVariableDefinition("productName", "d", TemplateVariableKind.Text, "Mustard Oil", []),
        new NotificationTemplateVariableDefinition("dueOn", "d", TemplateVariableKind.Date, "2026-10-12", []),
        new NotificationTemplateVariableDefinition("orderLink", "d", TemplateVariableKind.Url, "https://x/y", []),
    ];

    private static Dictionary<string, string> BaseValues() => new()
    {
        ["customerName"] = "Mitu",
        ["productName"] = "Mustard Oil",
        ["dueOn"] = "2026-10-12",
        ["orderLink"] = "https://portal.example.com/portal/orders/abc",
        [StandardTemplateVariables.OutletName] = "Amar Gram",
        [StandardTemplateVariables.OutletPhone] = "+8801700000000",
    };

    [Fact]
    public void MaliciousCustomerName_RendersAsLiteralText_NoMarkupNoExpansion()
    {
        var values = BaseValues();
        values["customerName"] = "**Mitu**](https://evil){{resetLink}}";

        var content = new NotificationTemplateChannelDefault(NotificationChannel.Email, "Subject", null, "Hello {{customerName}}!", null);
        var rendered = NotificationRenderer.Render(content, Variables, values, NotificationChannel.Email);

        Assert.DoesNotContain("<strong>", rendered.HtmlBody);
        Assert.DoesNotContain("<a ", rendered.HtmlBody);
        Assert.Contains("**Mitu**]", rendered.TextBody);
        Assert.Contains("(https://evil)", rendered.TextBody);
        // The literal characters appear HTML-encoded, and {{resetLink}} was never expanded --
        // no resetLink value exists in `values`, so an expansion attempt would have thrown.
        Assert.Contains("Mitu", rendered.HtmlBody!);
    }

    [Fact]
    public void ScriptTagInValue_IsHtmlEncodedInHtmlBody_LiteralInTextBody()
    {
        var values = BaseValues();
        values["customerName"] = "<script>";

        var content = new NotificationTemplateChannelDefault(NotificationChannel.Email, "Subject", null, "Hello {{customerName}}!", null);
        var rendered = NotificationRenderer.Render(content, Variables, values, NotificationChannel.Email);

        Assert.Contains("&lt;script&gt;", rendered.HtmlBody);
        Assert.Contains("<script>", rendered.TextBody);
    }

    [Fact]
    public void DateVariable_RendersInvariantEnglishFormat()
    {
        var values = BaseValues();
        var content = new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null, "Due {{dueOn}}", null);
        var rendered = NotificationRenderer.Render(content, Variables, values, NotificationChannel.Sms);

        Assert.Equal("Due 12 Oct 2026", rendered.TextBody);
    }

    [Fact]
    public void UrlVariable_NotHttps_Throws()
    {
        var values = BaseValues();
        values["orderLink"] = "http://not-https.example.com";

        var content = new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null, "Link {{orderLink}}", null);

        Assert.Throws<InvalidOperationException>(() => NotificationRenderer.Render(content, Variables, values, NotificationChannel.Sms));
    }

    [Theory]
    [InlineData("http://localhost:3000/reset-password#token=abc")]
    [InlineData("http://127.0.0.1:3000/reset-password#token=abc")]
    public void UrlVariable_LocalDevelopmentHttpLink_IsAllowed(string link)
    {
        // Owner decision 2026-10-15: password reset must work on a developer's machine (http://localhost:3000).
        var values = BaseValues();
        values["orderLink"] = link;

        var content = new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null, "Link {{orderLink}}", null);

        Assert.Contains(link, NotificationRenderer.Render(content, Variables, values, NotificationChannel.Sms).TextBody);
    }

    [Theory]
    [InlineData("http://localhost.evil.example/reset")]
    [InlineData("http://user@localhost/reset")]
    [InlineData("http://10.0.0.5/reset")]
    public void UrlVariable_OtherHttpLinks_StillThrow(string link)
    {
        var values = BaseValues();
        values["orderLink"] = link;

        var content = new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null, "Link {{orderLink}}", null);

        Assert.Throws<InvalidOperationException>(() => NotificationRenderer.Render(content, Variables, values, NotificationChannel.Sms));
    }

    [Fact]
    public void EmailLink_WithPlaceholderTarget_RendersAnchorTag()
    {
        var values = BaseValues();
        var content = new NotificationTemplateChannelDefault(NotificationChannel.Email, "Subject", null, "[Book now]({{orderLink}})", null);
        var rendered = NotificationRenderer.Render(content, Variables, values, NotificationChannel.Email);

        Assert.Contains($"<a href=\"{values["orderLink"]}\">Book now</a>", rendered.HtmlBody);
    }
}
