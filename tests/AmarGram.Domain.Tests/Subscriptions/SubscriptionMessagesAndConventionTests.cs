using System.Reflection;
using System.Text.RegularExpressions;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Platform.Infrastructure.Core.Events;
using static AmarGram.Domain.Tests.Subscriptions.SubscriptionTestSupport;

namespace AmarGram.Domain.Tests.Subscriptions;

/// <summary>HO-SUB-001 §15 E and X -- the eight subscription templates (the ninth, the clinic's, went with HO-P1), the display text, and the conventions that keep a payment token
/// and free text out of the slice (ADR-238, §11.5).</summary>
public sealed class SubscriptionMessagesAndConventionTests
{
    private static readonly string[] Keys =
    [
        "subscription.created", "subscription.changed", "subscription.cancelled", "subscription.pre-charge",
        "subscription.cycle-failed", "subscription.payment-reminder", "subscription.suspended", "subscription.resumed",
    ];

    public static IEnumerable<object[]> AllKeys() => Keys.Select(k => new object[] { k });

    // ── E: messages ──────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void U_E1_ThereAreExactlyEightSubscriptionTemplates_InTheCatalogue()
    {
        var found = NotificationTemplateCatalogue.Definitions.Where(d => d.Key.StartsWith("subscription.", StringComparison.Ordinal)).Select(d => d.Key).OrderBy(k => k);
        Assert.Equal(Keys.OrderBy(k => k), found);
        Assert.DoesNotContain(NotificationTemplateCatalogue.Definitions, d => d.Key == "subscription.authorisation-lapsed");   // the clinic's message is retired
    }

    [Theory]
    [MemberData(nameof(AllKeys))]
    public void U_E1_EveryTemplate_PassesTemplateRules_IsTransactional_AndCarriesNoSecret(string key)
    {
        var definition = NotificationTemplateCatalogue.Find(key)!;
        Assert.Equal(NotificationCategory.Transactional, definition.Category);
        Assert.False(definition.ContainsSecret);

        var contents = definition.Channels
            .Select(channel => definition.DefaultFor(channel)!)
            .Select(d => new TemplateContentInput(d.Channel, d.Subject, d.Title, d.Body, d.LinkPath))
            .ToList();

        Assert.Null(TemplateRules.Validate(definition, contents));
    }

    [Fact]
    public void U_E1b_CreatedAndCancelled_AreUrgent_ChangedIsInAppOnly_TheRestAreNormal()
    {
        Assert.Equal(NotificationUrgency.Urgent, NotificationTemplateCatalogue.Find("subscription.created")!.Urgency);
        Assert.Equal(NotificationUrgency.Urgent, NotificationTemplateCatalogue.Find("subscription.cancelled")!.Urgency);
        Assert.Equal([NotificationChannel.InApp], NotificationTemplateCatalogue.Find("subscription.changed")!.Channels);

        foreach (var key in Keys.Except(["subscription.created", "subscription.cancelled"]))
            Assert.Equal(NotificationUrgency.Normal, NotificationTemplateCatalogue.Find(key)!.Urgency);

        foreach (var key in Keys.Except(["subscription.changed"]))
            Assert.Equal(3, NotificationTemplateCatalogue.Find(key)!.Channels.Count);
    }

    [Fact]
    public void ThePreChargeNotice_CarriesASkipLink_OnEveryChannel()
    {
        var definition = NotificationTemplateCatalogue.Find("subscription.pre-charge")!;
        var skip = definition.Variables.Single(v => v.Name == "skipLink");

        Assert.Equal(TemplateVariableKind.Url, skip.Kind);
        Assert.Equal(3, skip.RequiredOn.Count);
        Assert.Contains(definition.Variables, v => v.Name == "manageLink");
    }

    [Fact]
    public void U_E6_ThePayByTime_IsFormattedInTheCommerceZone()
    {
        var local = Clock(Oct1).LocalTimeOf(new DateTimeOffset(2026, 10, 22, 4, 30, 0, TimeSpan.Zero));

        Assert.Equal("Thu 22 Oct 2026, 10:30", SubscriptionMessages.DayTime(local));
        Assert.Equal("Thu 22 Oct", SubscriptionMessages.Day(D(10, 22)));
    }

    [Fact]
    public void TheMessages_NameWhatHappened_InPlainWords()
    {
        Assert.Equal("every 4 weeks", SubscriptionMessages.IntervalText(4));
        Assert.Contains("2 unpaid orders", SubscriptionMessages.SubscriptionSuspendedMessage(SubscriptionSuspensionReason.UnpaidCycles, 2));
        Assert.Contains("no longer available", SubscriptionMessages.SubscriptionSuspendedMessage(SubscriptionSuspensionReason.ProductUnavailable, 2));
        Assert.Equal("Cash on delivery", SubscriptionMessages.PaymentMethodText(SubscriptionPaymentMethod.CashOnDelivery));
        Assert.Equal(
            "The delivery on Tue 20 Oct can no longer be skipped. You can skip the one on Tue 17 Nov.",
            SubscriptionMessages.CycleNoLongerSkippable(new DateOnly(2026, 10, 20), new DateOnly(2026, 11, 17)));
        Assert.All(Enumeration.GetAll<SubscriptionCycleFailureReason>(), r => Assert.False(string.IsNullOrWhiteSpace(SubscriptionMessages.FailureReasonText(r))));
    }

    [Fact]
    public void TheKeys_AreDeterministic_AndTheOrderKeyIsTheSameGuidForTheSameCycle()
    {
        var id = Guid.Parse("11111111-2222-3333-4444-555555555555");

        Assert.Equal("sub:11111111222233334444555555555555:20261020", SubscriptionKeys.IdempotencyKey(id, D(10, 20)));
        Assert.Equal("sub:notice:11111111222233334444555555555555:20261020", SubscriptionKeys.NoticeDeduplicationKey(id, D(10, 20)));
        Assert.Equal(SubscriptionKeys.OrderIdempotencyGuid(id, D(10, 20)), SubscriptionKeys.OrderIdempotencyGuid(id, D(10, 20)));
        Assert.NotEqual(SubscriptionKeys.OrderIdempotencyGuid(id, D(10, 20)), SubscriptionKeys.OrderIdempotencyGuid(id, D(11, 17)));
        Assert.NotEqual(SubscriptionKeys.OrderIdempotencyGuid(id, D(10, 20)), SubscriptionKeys.OrderIdempotencyGuid(Guid.NewGuid(), D(10, 20)));
    }

    // ── X: conventions ───────────────────────────────────────────────────────────────────────────

    private static readonly Assembly DomainAssembly = typeof(SubscriptionAggregate).Assembly;

    [Fact]
    public void U_X1_NoSubscriptionEvent_HasAStringProperty()
    {
        var events = DomainAssembly.GetTypes().Where(t => t.Namespace == typeof(SubscriptionCreatedEvent).Namespace && typeof(Event).IsAssignableFrom(t) && !t.IsAbstract).ToList();
        Assert.True(events.Count >= 15, "the subscription events should be found");

        var strings = events.SelectMany(e => e.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(p => p.PropertyType == typeof(string)).Select(p => $"{e.Name}.{p.Name}")).ToList();

        Assert.True(strings.Count == 0, "String properties found: " + string.Join(", ", strings));
    }

    private static readonly Regex PaymentToken = new(@"card|token|\bpan\b|cvv|mandate|gateway|autoCharge", RegexOptions.IgnoreCase);

    private static IEnumerable<Type> SubscriptionDomainTypes() =>
        DomainAssembly.GetTypes().Where(t =>
            t.Namespace == typeof(SubscriptionAggregate).Namespace
            || t.Namespace == typeof(SubscriptionCreatedEvent).Namespace
            || t.Namespace == typeof(CreateSubscriptionDto).Namespace && t.Name.Contains("Subscription", StringComparison.Ordinal)
            || t == typeof(AmarGram.Domain.ValueObjects.SubscriptionTerms) || t == typeof(AmarGram.Domain.ValueObjects.SubscribedProduct));

    [Fact]
    public void U_X2_NoSubscriptionType_CarriesAPaymentTokenCardOrGatewayMember_ADR238()
    {
        var offenders = new List<string>();
        foreach (var type in SubscriptionDomainTypes())
        {
            foreach (var member in type.GetMembers(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
            {
                if (member.Name.Contains('<')) continue;   // compiler-generated
                if (PaymentToken.IsMatch(member.Name)) offenders.Add($"{type.Name}.{member.Name}");
            }
        }

        Assert.True(offenders.Count == 0, "Payment-shaped members found: " + string.Join(", ", offenders));
    }

    [Fact]
    public void U_X5_ThePaymentMethod_HasExactlyTheThreeOfflineValues_NoOnlineOne()
    {
        Assert.Equal(["CashOnDelivery", "BankTransfer", "PayAtPickup"], Enumeration.GetAll<SubscriptionPaymentMethod>().OrderBy(m => m.Value).Select(m => m.DisplayName));
        Assert.Equal(OrderPaymentMethod.CashOnDelivery, SubscriptionPaymentMethod.CashOnDelivery.ToOrderPaymentMethod());
        Assert.Equal(OrderPaymentMethod.BankTransfer, SubscriptionPaymentMethod.BankTransfer.ToOrderPaymentMethod());
        Assert.Equal(OrderPaymentMethod.PayOnCollection, SubscriptionPaymentMethod.PayAtPickup.ToOrderPaymentMethod());
    }

    [Fact]
    public void TheEnumerations_AreTheOnesSection10Lists()
    {
        Assert.Equal(["Active", "Paused", "Suspended", "Cancelled"], Enumeration.GetAll<SubscriptionStatus>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.DoesNotContain(Enumeration.GetAll<SubscriptionSuspensionReason>(), r => r.DisplayName is "AuthorisationExpired" or "CatDeceased" or "CatOwnerChanged");
        Assert.Equal(["UnpaidCycles", "ProductUnavailable"], Enumeration.GetAll<SubscriptionSuspensionReason>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(["Delivery", "Pickup"], Enumeration.GetAll<SubscriptionFulfilment>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(["Pause", "Cancel"], Enumeration.GetAll<SubscriptionPendingStatusChange>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(["Generated", "Failed"], Enumeration.GetAll<SubscriptionCycleOutcome>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(
            ["AwaitingPayment", "Confirmed", "Expired", "Cancelled", "Delivered", "Refused"],
            Enumeration.GetAll<SubscriptionCycleOrderState>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(
            ["OutOfStock", "ProductUnavailable", "PaymentMethodUnavailable", "DeliveryUnavailable", "DeliveryAddressMissing", "OrderRefused"],
            Enumeration.GetAll<SubscriptionCycleFailureReason>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(["Customer", "StaffReinstatement"], Enumeration.GetAll<SubscriptionResumeTrigger>().OrderBy(s => s.Value).Select(s => s.DisplayName));
        Assert.Equal(6, Enumeration.GetAll<SubscriptionCancellationReason>().Count(r => r.IsCustomerChoice));
        Assert.Equal(3, Enumeration.GetAll<SubscriptionCancellationReason>().Count(r => !r.IsCustomerChoice));
    }

    [Fact]
    public void TheAggregate_IsEntirelyFreeOfTheRetiredClinicVocabulary()
    {
        var names = SubscriptionDomainTypes().SelectMany(t => t.GetMembers(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly).Select(m => m.Name)).ToList();
        Assert.DoesNotContain(names, n => Regex.IsMatch(n, "Cat(Id|Name|Deceased)|Prescription|Authoris|Diet", RegexOptions.IgnoreCase));
    }

    [Fact]
    public void TheSubscriptionAggregates_AreTheOnlyTwoRoots_AndHoldNoOrderOrStockType()
    {
        var roots = DomainAssembly.GetTypes().Where(t => t.Namespace == typeof(SubscriptionAggregate).Namespace && !t.IsAbstract).Select(t => t.Name).OrderBy(n => n);
        Assert.Equal(["SubscriptionAggregate", "SubscriptionCycleAggregate"], roots);

        var properties = typeof(SubscriptionAggregate).GetProperties().Concat(typeof(SubscriptionCycleAggregate).GetProperties()).Select(p => p.Name);
        Assert.DoesNotContain(properties, n => n.Contains("Reservation") || n.Contains("Batch") || n.Contains("Invoice") || n.Contains("Total") || n.Contains("Price"));
    }
}
