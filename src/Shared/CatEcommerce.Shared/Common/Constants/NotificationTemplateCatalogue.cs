using CatEcommerce.Shared.Common.Enums;

namespace CatEcommerce.Shared.Common.Constants;

/// <summary>HO-NTF-001 §8.2. A single producer-supplied variable a template definition declares.</summary>
public sealed record NotificationTemplateVariableDefinition(
    string Name,
    string Description,
    TemplateVariableKind Kind,
    string Sample,
    IReadOnlyList<NotificationChannel> RequiredOn);

/// <summary>The shipped wording for one channel of a definition.</summary>
public sealed record NotificationTemplateChannelDefault(
    NotificationChannel Channel,
    string? Subject,
    string? Title,
    string Body,
    string? LinkPath);

/// <summary>
/// One row of the code-defined template catalogue (HO-NTF-001 §8.2). What exists is code; what it
/// says is data -- the actual wording lives on <c>NotificationTemplateAggregate</c> once customised.
/// </summary>
public sealed record NotificationTemplateDefinition(
    string Key,
    string DisplayName,
    string Description,
    NotificationCategory Category,
    NotificationUrgency Urgency,
    IReadOnlyList<NotificationChannel> Channels,
    bool ContainsSecret,
    IReadOnlyList<NotificationTemplateVariableDefinition> Variables,
    IReadOnlyList<NotificationTemplateChannelDefault> Defaults)
{
    public NotificationTemplateChannelDefault? DefaultFor(NotificationChannel channel) =>
        Defaults.FirstOrDefault(d => d.Channel == channel);
}

/// <summary>One channel's wording, as supplied by a command or the aggregate's stored contents --
/// the shape <c>TemplateRules.Validate</c> checks (HO-NTF-001 §8.2/§11.1 C1).</summary>
public sealed record TemplateContentInput(
    NotificationChannel Channel,
    string? Subject,
    string? Title,
    string Body,
    string? LinkPath);

/// <summary>
/// HO-NTF-001 §8.2 -- the shipped definitions. Later areas append their own (§1 Amended); none are
/// built by this pass beyond the one this handover itself owns (password reset).
/// </summary>
public static partial class NotificationTemplateCatalogue
{
    public const string PasswordReset = "account.password-reset";
    /// <summary>HO-SHP-001 §8.11 -- a <b>Marketing</b> template (HO-NTF-001 §4.2): a customer who asked
    /// for an alert but granted no marketing consent on any channel is told nothing (F33, OQ-2);
    /// the alert response's <c>deliverability</c> says so.</summary>
    public const string ShopBackInStock = "shop.back-in-stock";

    /// <summary>HO-IMP-001 §8.12 -- a recalled batch's customer notice (<c>BatchRecallGuard</c>).</summary>
    public const string InventoryBatchRecall = "inventory.batch-recall";
    /// <summary>HO-BIL-001 §8.12 (ADR-193) -- three Transactional templates ("payment" messages are
    /// exempt from marketing opt-out, FR-NTF-4). Enqueued by command handlers only.</summary>
    public const string BillingInvoiceIssued = "billing.invoice-issued";
    public const string BillingPaymentReceived = "billing.payment-received";
    public const string BillingRefundIssued = "billing.refund-issued";


    public static readonly IReadOnlyList<NotificationTemplateDefinition> Definitions =
    [
        new NotificationTemplateDefinition(
            PasswordReset, "Password reset", "Sent when a customer or staff member requests a password reset link.",
            NotificationCategory.Transactional, NotificationUrgency.Urgent,
            [NotificationChannel.Sms, NotificationChannel.Email], ContainsSecret: true,
            Variables:
            [
                new NotificationTemplateVariableDefinition("resetLink", "The one-time reset link.", TemplateVariableKind.Url, "https://portal.example.com/reset-password#token=sample", [NotificationChannel.Sms, NotificationChannel.Email]),
                new NotificationTemplateVariableDefinition("expiresInMinutes", "Minutes until the link expires.", TemplateVariableKind.Text, "15", []),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "Reset your Amar Gram password: {{resetLink}} (expires in {{expiresInMinutes}} minutes). If you did not request this, ignore this message.", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "Reset your Amar Gram password", null,
                    "Hello {{recipientName}},\n\nWe received a request to reset your Amar Gram password. [Reset your password]({{resetLink}}). This link expires in {{expiresInMinutes}} minutes.\n\nIf you did not request this, you can safely ignore this message.", null),
            ]),

        new NotificationTemplateDefinition(
            ShopBackInStock, "Back in stock", "Sent once when an item a customer asked to be told about is available again (HO-SHP-001 §8.11). Marketing: sent only on a channel the customer has granted marketing consent for.",
            NotificationCategory.Marketing, NotificationUrgency.Normal,
            [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp], ContainsSecret: false,
            Variables:
            [
                new NotificationTemplateVariableDefinition("productName", "The product's name.", TemplateVariableKind.Text, "Organic Mustard Oil", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
                new NotificationTemplateVariableDefinition("variantLabel", "The variant, such as \"2 kg · Salmon\".", TemplateVariableKind.Text, "2 kg", []),
                new NotificationTemplateVariableDefinition("productLink", "A link to the product page with the variant selected.", TemplateVariableKind.Url, "https://portal.example.com/shop/products/organic-mustard-oil?sku=00000000-0000-0000-0000-000000000000", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "{{productName}} ({{variantLabel}}) is back in stock: {{productLink}} Stop alerts: {{unsubscribeLink}}", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "{{productName}} is back in stock", null,
                    "Hello {{recipientName}},\n\n{{productName}} ({{variantLabel}}) is back in stock. [See it in the shop]({{productLink}}).\n\n[Stop these alerts]({{unsubscribeLink}})", null),
                new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "Back in stock",
                    "{{productName}} ({{variantLabel}}) is back in stock. Stop alerts: {{unsubscribeLink}}", "{{productLink}}"),
            ]),

        new NotificationTemplateDefinition(
            InventoryBatchRecall, "Product recall", "Sent once to every customer who received a recalled batch (HO-IMP-001 §8.12). A safety notice: transactional, urgent, ignores quiet hours (OQ-6).",
            NotificationCategory.Transactional, NotificationUrgency.Urgent,
            [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp], ContainsSecret: false,
            Variables:
            [
                new NotificationTemplateVariableDefinition("productName", "The recalled product's name.", TemplateVariableKind.Text, "Organic Mustard Oil 1 L", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
                new NotificationTemplateVariableDefinition("lotNumber", "The recalled lot.", TemplateVariableKind.Text, "L2406-17", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
                // Text rather than Date (a deviation from §8.12, recorded in HO-IMP-001 §1 Amended): an undated
                // batch (a General SKU) has no expiry to give, and a Date variable that is not a date cannot render.
                new NotificationTemplateVariableDefinition("expiresOn", "The lot's expiry date (yyyy-MM-dd), or \"no expiry date\".", TemplateVariableKind.Text, "2027-03-31", []),
                new NotificationTemplateVariableDefinition("customerAdvice", "What the owner should do.", TemplateVariableKind.Text, "Stop using it and keep the packaging.", [NotificationChannel.Email, NotificationChannel.InApp]),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "Safety recall from {{outletName}}: {{productName}}, lot {{lotNumber}} (expires {{expiresOn}}). Please stop using it and call {{outletPhone}}.", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "Safety recall: {{productName}}", null,
                    "Hello {{recipientName}},\n\n{{productName}}, lot {{lotNumber}} (expires {{expiresOn}}), has been recalled.\n\n{{customerAdvice}}\n\nPlease call {{outletName}} on {{outletPhone}} if you have any questions.", null),
                new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "Product recall",
                    "{{productName}}, lot {{lotNumber}} (expires {{expiresOn}}), has been recalled. {{customerAdvice}} Call {{outletPhone}} with any questions.", null),
            ]),

        new NotificationTemplateDefinition(
            BillingInvoiceIssued, "Invoice issued", "Sent when an invoice is issued to a customer (HO-BIL-001 §8.12).",
            NotificationCategory.Transactional, NotificationUrgency.Normal,
            [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp], ContainsSecret: false,
            Variables:
            [
                new NotificationTemplateVariableDefinition("invoiceNumber", "The invoice number.", TemplateVariableKind.Text, "INV-MAIN-2627-000123", []),
                new NotificationTemplateVariableDefinition("totalText", "The invoice total, formatted with its currency.", TemplateVariableKind.Text, "BDT 1,500.00", []),
                new NotificationTemplateVariableDefinition("dueOn", "The date payment is due.", TemplateVariableKind.Date, "2026-10-12", []),
                new NotificationTemplateVariableDefinition("invoiceLink", "A link to view the invoice.", TemplateVariableKind.Url, "https://portal.example.com/portal/billing/invoices/sample", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "Invoice {{invoiceNumber}} for {{totalText}} is due on {{dueOn}}. View: {{invoiceLink}}", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "Your invoice {{invoiceNumber}}", null,
                    "Hello {{recipientName}},\n\nInvoice {{invoiceNumber}} for {{totalText}} is due on {{dueOn}}. [View your invoice]({{invoiceLink}}).", null),
                new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "New invoice",
                    "Invoice {{invoiceNumber}} for {{totalText}} is due on {{dueOn}}.", "{{invoiceLink}}"),
            ]),

        new NotificationTemplateDefinition(
            BillingPaymentReceived, "Payment received", "Sent when a payment is recorded and accepted (HO-BIL-001 §8.12).",
            NotificationCategory.Transactional, NotificationUrgency.Normal,
            [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp], ContainsSecret: false,
            Variables:
            [
                new NotificationTemplateVariableDefinition("amountText", "The amount received, formatted with its currency.", TemplateVariableKind.Text, "BDT 500.00", []),
                new NotificationTemplateVariableDefinition("methodName", "How the payment was made.", TemplateVariableKind.Text, "CashInStore", []),
                new NotificationTemplateVariableDefinition("receiptNumber", "The receipt number.", TemplateVariableKind.Text, "R-000123", []),
                new NotificationTemplateVariableDefinition("purposeText", "What the payment went towards.", TemplateVariableKind.Text, "INV-MAIN-2627-000123", []),
                new NotificationTemplateVariableDefinition("receiptLink", "A link to view the receipt.", TemplateVariableKind.Url, "https://portal.example.com/portal/billing/payments/sample", [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp]),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "We received {{amountText}} ({{methodName}}) for {{purposeText}}. Receipt {{receiptNumber}}: {{receiptLink}}", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "Payment received - receipt {{receiptNumber}}", null,
                    "Hello {{recipientName}},\n\nWe received {{amountText}} ({{methodName}}) for {{purposeText}}. [View receipt {{receiptNumber}}]({{receiptLink}}).", null),
                new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "Payment received",
                    "We received {{amountText}} ({{methodName}}) for {{purposeText}}. Receipt {{receiptNumber}}.", "{{receiptLink}}"),
            ]),

        new NotificationTemplateDefinition(
            BillingRefundIssued, "Refund issued", "Sent when a refund is issued to a customer (HO-BIL-001 §8.12). The reason is never sent.",
            NotificationCategory.Transactional, NotificationUrgency.Normal,
            [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp], ContainsSecret: false,
            Variables:
            [
                new NotificationTemplateVariableDefinition("amountText", "The amount refunded, formatted with its currency.", TemplateVariableKind.Text, "BDT 200.00", []),
                new NotificationTemplateVariableDefinition("methodName", "How the refund was paid.", TemplateVariableKind.Text, "CashInStore", []),
                new NotificationTemplateVariableDefinition("creditNoteNumber", "The credit note number, or a dash.", TemplateVariableKind.Text, "CN-MAIN-2627-000007", []),
            ],
            Defaults:
            [
                new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null,
                    "We refunded {{amountText}} ({{methodName}}). Credit note: {{creditNoteNumber}}.", null),
                new NotificationTemplateChannelDefault(NotificationChannel.Email, "Your refund", null,
                    "Hello {{recipientName}},\n\nWe refunded {{amountText}} ({{methodName}}). Credit note: {{creditNoteNumber}}.", null),
                new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "Refund issued",
                    "We refunded {{amountText}} ({{methodName}}). Credit note: {{creditNoteNumber}}.", null),
            ]),

        .. OrderDefinitions(),
        .. ReportingDefinitions(),
    ];

    public static NotificationTemplateDefinition? Find(string key) =>
        Definitions.FirstOrDefault(d => string.Equals(d.Key, key, StringComparison.Ordinal));
}
