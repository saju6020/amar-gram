using CatEcommerce.Domain.DomainServices;
using CatEcommerce.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace CatEcommerce.Infrastructure.Notifications;

/// <summary>
/// HO-NTF-001 §8.8. Integrator instruction (2026-09-27): the web base URL is the ONE shared
/// <see cref="PublicSiteOptions.WebBaseUrl"/>, not this area's own <c>NotificationOptions.WebBaseUrl</c>
/// (removed). The api base URL has no shared equivalent and stays <see cref="NotificationOptions.ApiBaseUrl"/>.
/// </summary>
public sealed class NotificationLinkBuilder(IOptions<NotificationOptions> options, IOptions<PublicSiteOptions> publicSiteOptions) : INotificationLinkBuilder
{
    public string PasswordResetLink(string token) => $"{Base()}/reset-password#token={token}";

    public string InvoiceLink(Guid invoiceId) => $"{Base()}/portal/billing/invoices/{invoiceId}";

    public string ReceiptLink(Guid paymentId) => $"{Base()}/portal/billing/payments/{paymentId}";

    public string OrderLink(Guid orderId) => $"{Base()}/portal/orders/{orderId}";

    public string ProductLink(string slug, Guid skuId) => $"{Base()}/shop/products/{Uri.EscapeDataString(slug)}?sku={skuId}";

    /// <summary>HO-RPT-001 section 11.7 item 7: the staff link to the report a scheduled email is about; <c>all</c> when the schedule covers every branch.</summary>
    public string ReportLink(string reportKey, DateOnly from, DateOnly to, Guid? branchId) =>
        $"{Base()}/staff/reports/{Uri.EscapeDataString(reportKey)}?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&branchId={(branchId is { } id ? id.ToString() : "all")}";

    public string UnsubscribeLink(string token) => $"{Base()}/unsubscribe#token={token}";

    public string OneClickUnsubscribeUrl(string token) => $"{options.Value.ApiBaseUrl.TrimEnd('/')}/api/notifications/unsubscribe/one-click?token={Uri.EscapeDataString(token)}";

    private string Base() => publicSiteOptions.Value.WebBaseUrl.TrimEnd('/');
}
