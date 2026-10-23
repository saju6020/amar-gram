namespace CatEcommerce.Domain.DomainServices;

/// <summary>
/// HO-NTF-001 §8.8 -- implemented in Infrastructure over the shared
/// <c>PublicSiteOptions.WebBaseUrl</c> (integrator instruction, 2026-09-27) and this area's own
/// <c>NotificationOptions.ApiBaseUrl</c>.
/// </summary>
public interface INotificationLinkBuilder
{
    string PasswordResetLink(string token);
    string UnsubscribeLink(string token);
    string OneClickUnsubscribeUrl(string token);

    /// <summary>HO-SHP-001 §8.11 -- <c>{WebBaseUrl}/shop/products/{slug}?sku={skuId}</c>. Used for
    /// <c>productLink</c> on <c>shop.back-in-stock</c>.</summary>
    string ProductLink(string slug, Guid skuId);

    /// <summary>HO-BIL-001 §8.12 -- <c>{WebBaseUrl}/portal/billing/invoices/{id}</c>. Used for <c>invoiceLink</c> on
    /// <c>billing.invoice-issued</c>.</summary>
    string InvoiceLink(Guid invoiceId);

    /// <summary>HO-BIL-001 §8.12 -- <c>{WebBaseUrl}/portal/billing/payments/{id}</c>. Used for <c>receiptLink</c> on
    /// <c>billing.payment-received</c>.</summary>
    string ReceiptLink(Guid paymentId);

    /// <summary>HO-ORD-001 §8.12 -- <c>{WebBaseUrl}/portal/orders/{orderId}</c>. Used for <c>orderLink</c> on every <c>order.*</c> message.</summary>
    string OrderLink(Guid orderId);

    /// <summary>HO-RPT-001 section 11.7: a staff link to the report the scheduled email is about. branchId null means every branch.</summary>
    string ReportLink(string reportKey, DateOnly from, DateOnly to, Guid? branchId) => throw new NotSupportedException("This link builder does not build report links.");
}
