using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-SUB-001 §8.11 (ADR-245, ADR-246) -- the eight subscription templates appended to HO-NTF-001's catalogue (the ninth, <c>subscription.authorisation-lapsed</c>,
/// went with the clinic, HO-P1). All <b>Transactional</b>: they concern an order the customer asked for. <c>created</c> and <c>cancelled</c> are <b>Urgent</b> (the
/// customer did it seconds ago); <c>changed</c> is in-app only. Every dynamic value is display text built by the producer
/// (<see cref="SubscriptionMessages"/>); none carries a decision. Dates are pre-formatted local text (<c>Tue 20 Oct</c>), money <c>BDT 1,450.00</c>.
/// Enqueued by command handlers or the subscription worker only (HO-NTF-001 ADR-057).
/// </summary>
public static partial class NotificationTemplateCatalogue
{
    public const string SubscriptionCreated = "subscription.created";
    public const string SubscriptionChanged = "subscription.changed";
    public const string SubscriptionCancelled = "subscription.cancelled";
    public const string SubscriptionPreCharge = "subscription.pre-charge";
    public const string SubscriptionCycleFailed = "subscription.cycle-failed";
    public const string SubscriptionPaymentReminder = "subscription.payment-reminder";
    public const string SubscriptionSuspended = "subscription.suspended";
    public const string SubscriptionResumed = "subscription.resumed";

    private static NotificationChannel[] SubAllChannels => [NotificationChannel.Sms, NotificationChannel.Email, NotificationChannel.InApp];

    private static NotificationTemplateVariableDefinition SubText(string name, string description, string sample, params NotificationChannel[] on) =>
        new(name, description, TemplateVariableKind.Text, sample, on);

    private static NotificationTemplateVariableDefinition SubLink(string name, string description, string path, params NotificationChannel[] on) =>
        new(name, description, TemplateVariableKind.Url, "https://portal.example.com" + path, on);

    private static NotificationTemplateDefinition SubTemplate(
        string key, string displayName, string description, NotificationUrgency urgency, IReadOnlyList<NotificationTemplateVariableDefinition> variables,
        string sms, string emailSubject, string emailBody, string inAppTitle, string inAppBody, string inAppLink) =>
        new(key, displayName, description, NotificationCategory.Transactional, urgency, SubAllChannels, ContainsSecret: false, variables,
        [
            new NotificationTemplateChannelDefault(NotificationChannel.Sms, null, null, sms, null),
            new NotificationTemplateChannelDefault(NotificationChannel.Email, emailSubject, null, emailBody, null),
            new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, inAppTitle, inAppBody, inAppLink),
        ]);

    private static IReadOnlyList<NotificationTemplateDefinition> SubscriptionDefinitions()
    {
        var all = SubAllChannels;
        NotificationChannel[] inApp = [NotificationChannel.InApp];

        return
        [
            SubTemplate(
                SubscriptionCreated, "Subscription started", "Sent when a customer starts a subscription (HO-SUB-001 §8.11).", NotificationUrgency.Urgent,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("quantity", "Units per delivery.", "2", all),
                    SubText("intervalText", "How often, in words.", "every 4 weeks", all),
                    SubText("firstDeliveryOn", "The date of the first order, as text.", "Tue 20 Oct", all),
                    SubText("paymentMethodText", "How each order will be paid.", "Cash on delivery", all),
                    SubLink("manageLink", "A link to manage the subscription.", "/portal/subscriptions/sample", all),
                ],
                "Subscribed: {{quantity}} x {{productName}} {{intervalText}}. First order {{firstDeliveryOn}}. {{paymentMethodText}}. Manage: {{manageLink}}",
                "Your subscription to {{productName}}",
                "Hello {{recipientName}},\n\nYou are subscribed to {{quantity}} x {{productName}} {{intervalText}}. Your first order is raised on {{firstDeliveryOn}}. Payment: {{paymentMethodText}}.\n\n[Manage your subscription]({{manageLink}}).",
                "Subscription started",
                "{{quantity}} x {{productName}} {{intervalText}}. First order {{firstDeliveryOn}}. {{paymentMethodText}}.",
                "{{manageLink}}"),

            new NotificationTemplateDefinition(
                SubscriptionChanged, "Subscription changed", "Sent in the app when a subscription is changed, skipped, paused or resumed (HO-SUB-001 §8.11).",
                NotificationCategory.Transactional, NotificationUrgency.Normal, inApp, ContainsSecret: false,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", inApp),
                    SubText("changeMessage", "What changed and from which delivery, in plain words.", "Done. Your next delivery on Tue 20 Oct will be 3 x Red lentils 1 kg.", inApp),
                    SubLink("manageLink", "A link to manage the subscription.", "/portal/subscriptions/sample", inApp),
                ],
                [new NotificationTemplateChannelDefault(NotificationChannel.InApp, null, "Subscription updated", "{{productName}}: {{changeMessage}}", "{{manageLink}}")]),

            SubTemplate(
                SubscriptionCancelled, "Subscription cancelled", "Sent when a subscription is cancelled, by the customer or by the shop (HO-SUB-001 §8.11).", NotificationUrgency.Urgent,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("endsText", "When it ends, in words.", "now", all),
                    SubLink("subscriptionsLink", "A link to the customer's subscriptions.", "/portal/subscriptions", all),
                ],
                "Your subscription to {{productName}} ends {{endsText}}. Your subscriptions: {{subscriptionsLink}}",
                "Your subscription to {{productName}} has been cancelled",
                "Hello {{recipientName}},\n\nYour subscription to {{productName}} ends {{endsText}}.\n\n[Your subscriptions]({{subscriptionsLink}}).",
                "Subscription cancelled",
                "Your subscription to {{productName}} ends {{endsText}}.",
                "{{subscriptionsLink}}"),

            SubTemplate(
                SubscriptionPreCharge, "Subscription order coming up", "Sent a few days before each subscription order is raised, with a link to skip it (HO-SUB-001 §8.8).", NotificationUrgency.Normal,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("quantity", "Units in the order.", "2", all),
                    SubText("deliveryOn", "The date the order is raised, as text.", "Tue 20 Oct", all),
                    SubText("paymentMethodText", "How the order will be paid.", "Cash on delivery", all),
                    SubText("estimatedAmount", "The estimated goods total, formatted with its currency.", "BDT 1,450.00", all),
                    SubLink("skipLink", "A link that skips this delivery.", "/portal/subscriptions/sample?skip=2026-10-20", all),
                    SubLink("manageLink", "A link to manage the subscription.", "/portal/subscriptions/sample", all),
                ],
                "{{quantity}} x {{productName}} is ordered on {{deliveryOn}} (about {{estimatedAmount}}, {{paymentMethodText}}). Skip it: {{skipLink}} Change it: {{manageLink}}",
                "Your {{productName}} order is coming up on {{deliveryOn}}",
                "Hello {{recipientName}},\n\nYour subscription order of {{quantity}} x {{productName}} is raised on {{deliveryOn}}. Estimated goods total: {{estimatedAmount}} (delivery and tax are added when the order is placed). Payment: {{paymentMethodText}}.\n\n[Skip this delivery]({{skipLink}}) or [change your subscription]({{manageLink}}).",
                "Subscription order coming up",
                "{{quantity}} x {{productName}} on {{deliveryOn}}, about {{estimatedAmount}}, {{paymentMethodText}}. You can skip it ({{skipLink}}).",
                "{{manageLink}}"),

            SubTemplate(
                SubscriptionCycleFailed, "Subscription order not placed", "Sent when a subscription order could not be placed on its date (HO-SUB-001 §8.6).", NotificationUrgency.Normal,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("cycleOn", "The date that was missed, as text.", "Tue 20 Oct", all),
                    SubText("reasonText", "Why, in plain words.", "It was out of stock.", all),
                    SubLink("manageLink", "A link to manage the subscription.", "/portal/subscriptions/sample", all),
                ],
                "We could not place your {{productName}} order for {{cycleOn}}: {{reasonText}} Manage: {{manageLink}}",
                "We could not place your {{productName}} order",
                "Hello {{recipientName}},\n\nWe could not place your subscription order for {{productName}} on {{cycleOn}}. {{reasonText}}\n\n[Manage your subscription]({{manageLink}}).",
                "Subscription order not placed",
                "{{productName}} on {{cycleOn}}: {{reasonText}}",
                "{{manageLink}}"),

            SubTemplate(
                SubscriptionPaymentReminder, "Subscription payment reminder", "Sent before a held bank-transfer subscription order expires (HO-SUB-001 §8.9).", NotificationUrgency.Normal,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("amountDue", "The amount to transfer, formatted with its currency.", "BDT 1,927.50", all),
                    SubText("payByLocal", "When payment is due, in the shop's time zone.", "Thu 22 Oct 2026, 10:30", all),
                    SubLink("orderLink", "A link to the order page, which shows the bank details.", "/portal/orders/sample", all),
                ],
                "Reminder: please transfer {{amountDue}} for your {{productName}} order by {{payByLocal}} or it will expire. {{orderLink}}",
                "Please pay for your {{productName}} order by {{payByLocal}}",
                "Hello {{recipientName}},\n\nYour subscription order for {{productName}} is waiting for a bank transfer of {{amountDue}}. Please pay by {{payByLocal}}, or the order expires and the items are released.\n\n[View the order]({{orderLink}}).",
                "Payment reminder",
                "Transfer {{amountDue}} for {{productName}} by {{payByLocal}} or the order expires.",
                "{{orderLink}}"),

            SubTemplate(
                SubscriptionSuspended, "Subscription paused by the shop", "Sent when a subscription is suspended: unpaid orders or a product no longer sold (HO-SUB-001 §8.9).", NotificationUrgency.Normal,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("reasonText", "Why, in plain words.", "This subscription was paused after two unpaid orders. Please contact the shop to restart it.", all),
                    SubLink("manageLink", "A link to the subscription.", "/portal/subscriptions/sample", all),
                ],
                "Your subscription to {{productName}} is paused. {{reasonText}} {{manageLink}}",
                "Your subscription to {{productName}} is paused",
                "Hello {{recipientName}},\n\nYour subscription to {{productName}} has been paused. {{reasonText}}\n\n[View your subscription]({{manageLink}}).",
                "Subscription paused",
                "{{productName}}: {{reasonText}}",
                "{{manageLink}}"),

            SubTemplate(
                SubscriptionResumed, "Subscription restarted", "Sent when the shop restarts a suspended subscription (HO-SUB-001 §8.11).", NotificationUrgency.Normal,
                [
                    SubText("productName", "The subscribed product.", "Red lentils 1 kg", all),
                    SubText("nextDeliveryOn", "The date of the next order, as text.", "Tue 20 Oct", all),
                    SubLink("manageLink", "A link to manage the subscription.", "/portal/subscriptions/sample", all),
                ],
                "Your subscription to {{productName}} is back on. Next order {{nextDeliveryOn}}. {{manageLink}}",
                "Your subscription to {{productName}} is back on",
                "Hello {{recipientName}},\n\nYour subscription to {{productName}} has been restarted. The next order is raised on {{nextDeliveryOn}}.\n\n[Manage your subscription]({{manageLink}}).",
                "Subscription restarted",
                "{{productName}} is back on. Next order {{nextDeliveryOn}}.",
                "{{manageLink}}"),
        ];
    }
}
