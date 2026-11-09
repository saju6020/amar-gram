using AmarGram.Application.CommandHandlers.Subscription;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Fakes.Administration;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Tests.TestSupport;

/// <summary>Hand-written doubles for the Subscriptions ports (no mocking library is in scope), plus the builders the HO-SUB-001 handler tests start from.
/// Time is the Dhaka commerce zone; <see cref="Oct1"/> is 1 Oct 2026 12:00 there, with a 2-day cut-off.</summary>
public sealed class FakeCommerceClock(DateTimeOffset now, int cutoffDays = 2) : ICommerceClock
{
    public Task<SubscriptionClock> GetAsync(CancellationToken ct = default) => GetAtAsync(now, ct);

    public Task<SubscriptionClock> GetAtAsync(DateTimeOffset at, CancellationToken ct = default) =>
        Task.FromResult(SubscriptionClock.Create(at, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka"), cutoffDays));
}

public sealed class FakeSubscribableCatalogue : ISubscribableCatalogue
{
    public Dictionary<Guid, SubscribableSkuFacts> Skus { get; } = [];

    public SubscribableSkuFacts Add(Guid skuId, bool purchasable = true, bool subscribable = true, decimal price = 100m) =>
        Skus[skuId] = new SubscribableSkuFacts(skuId, Guid.NewGuid(), "Red lentils", "1 kg", purchasable, subscribable, price, "BDT");

    public Task<IReadOnlyDictionary<Guid, SubscribableSkuFacts>> GetAsync(IReadOnlyCollection<Guid> skuIds, DateTimeOffset asOf, CancellationToken ct) =>
        Task.FromResult<IReadOnlyDictionary<Guid, SubscribableSkuFacts>>(skuIds.Where(Skus.ContainsKey).Distinct().ToDictionary(id => id, id => Skus[id]));
}

public sealed class FakeSubscriptionFinder(
    FakeAggregateRootRepository<SubscriptionAggregate> subscriptions, FakeAggregateRootRepository<SubscriptionCycleAggregate> cycles) : ISubscriptionFinder
{
    public Task<int> CountLiveAsync(Guid customerId, CancellationToken ct) =>
        Task.FromResult(subscriptions.All.Count(s => s.CustomerId == customerId && s.IsLive));

    public Task<Guid?> FindLiveIdAsync(Guid customerId, Guid skuId, CancellationToken ct) =>
        Task.FromResult(subscriptions.All.Where(s => s.CustomerId == customerId && s.SkuId == skuId && s.IsLive).Select(s => (Guid?)s.Id).FirstOrDefault());

    public Task<IReadOnlyList<Guid>> FindIdsByCustomerAsync(Guid customerId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Guid>>(subscriptions.All.Where(s => s.CustomerId == customerId).OrderBy(s => s.StartedOn).Select(s => s.Id).ToList());

    public Task<IReadOnlyList<Guid>> FindCycleIdsByCustomerAsync(Guid customerId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Guid>>(cycles.All.Where(c => c.CustomerId == customerId).OrderBy(c => c.CycleOn).Select(c => c.Id).ToList());

    public Task<Guid?> FindCycleIdAsync(Guid subscriptionId, DateOnly cycleOn, CancellationToken ct) =>
        Task.FromResult(cycles.All.Where(c => c.SubscriptionId == subscriptionId && c.CycleOn == cycleOn).Select(c => (Guid?)c.Id).FirstOrDefault());

    public Task<IReadOnlyList<StreakCycle>> LatestCyclesAsync(Guid subscriptionId, int take, DateTimeOffset? since, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<StreakCycle>>(cycles.All
            .Where(c => c.SubscriptionId == subscriptionId && (since is null || c.ProcessedOn > since))
            .OrderByDescending(c => c.CycleOn).Take(take).Select(c => new StreakCycle(c.Outcome, c.OrderState)).ToList());
}

/// <summary>Saves the new cycle into the fake repository, or reports a lost race on <c>ix_subscription_cycle_per_date</c> when told to.</summary>
public sealed class FakeSubscriptionCycleStore(FakeAggregateRootRepository<SubscriptionCycleAggregate> cycles) : ISubscriptionCycleStore
{
    public bool LoseTheRace { get; set; }
    public int Attempts { get; private set; }

    public async Task<bool> TrySaveAsync(SubscriptionCycleAggregate cycle, CancellationToken ct = default)
    {
        Attempts++;
        if (LoseTheRace) return false;

        await cycles.SaveAsync(cycle, EventPublishOption.InMemoryPublishOnly);
        return true;
    }
}

public sealed class FakeLinkBuilder : INotificationLinkBuilder
{
    public string PasswordResetLink(string token) => "https://t/reset/" + token;
    public string UnsubscribeLink(string token) => "https://t/unsub/" + token;
    public string OneClickUnsubscribeUrl(string token) => "https://t/unsub1/" + token;
    public string ProductLink(string slug, Guid skuId) => $"https://t/p/{slug}?sku={skuId}";
    public string InvoiceLink(Guid invoiceId) => "https://t/invoice/" + invoiceId;
    public string ReceiptLink(Guid paymentId) => "https://t/receipt/" + paymentId;
    public string OrderLink(Guid orderId) => "https://t/orders/" + orderId;
    public string SubscriptionLink(Guid subscriptionId) => "https://t/portal/subscriptions/" + subscriptionId;
    public string SubscriptionSkipLink(Guid subscriptionId, DateOnly cycleOn) => $"https://t/portal/subscriptions/{subscriptionId}?skip={cycleOn:yyyy-MM-dd}";
    public string SubscriptionsLink() => "https://t/portal/subscriptions";
}

/// <summary>The fixture every handler test builds: the stores, the ports and the aggregates in the states the tests need.</summary>
public sealed class SubscriptionWorld
{
    public static readonly DateTimeOffset Oct1 = new(2026, 10, 1, 6, 0, 0, TimeSpan.Zero);          // 12:00 in Dhaka; earliest delivery 4 Oct
    public static readonly DateTimeOffset Oct1Locked = new(2026, 10, 1, 18, 0, 0, TimeSpan.Zero);   // 4 Oct is past its cut-off

    public static DateOnly D(int month, int day) => new(2026, month, day);

    public Guid CustomerId { get; } = Guid.NewGuid();
    public Guid SkuId { get; } = Guid.NewGuid();
    public Guid AddressId { get; } = Guid.NewGuid();

    public FakeAggregateRootRepository<SubscriptionAggregate> Subscriptions { get; } = new();
    public FakeAggregateRootRepository<SubscriptionCycleAggregate> Cycles { get; } = new();
    public FakeSubscriptionFinder Finder { get; }
    public FakeSubscriptionCycleStore CycleStore { get; }
    public FakeSubscribableCatalogue Catalogue { get; } = new();
    public FakeNotificationOutbox Outbox { get; } = new();
    public FakeLinkBuilder Links { get; } = new();
    public InMemoryBusinessSettings Settings { get; }
    public DateTimeOffset Now { get; }
    public FakeCommerceClock Clock { get; }

    public SubscriptionWorld(DateTimeOffset? now = null, int maxUnpaid = 2, int reminderHours = 24)
    {
        Now = now ?? Oct1;
        Clock = new FakeCommerceClock(Now);
        Finder = new FakeSubscriptionFinder(Subscriptions, Cycles);
        CycleStore = new FakeSubscriptionCycleStore(Cycles);
        Catalogue.Add(SkuId);
        Settings = new InMemoryBusinessSettings(new Dictionary<string, object>
        {
            [SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles] = maxUnpaid,
            [SettingKeys.SubscriptionPaymentReminderHours] = reminderHours,
            [SettingKeys.SubscriptionDiscountPercent] = 0m,
            [SettingKeys.SubscriptionChangeCutoffDays] = 2,
            [SettingKeys.CommerceCurrencyCode] = "BDT",
        });
    }

    public SubscriptionClock ClockAt(DateTimeOffset at) => SubscriptionClock.Create(at, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka"), 2);

    public UserContext CustomerUser(Guid? id = null) => new(id ?? CustomerId, Guid.NewGuid()) { UserName = "customer", Roles = ["Customer"] };

    public UserContext StaffUser() => new(Guid.NewGuid(), Guid.NewGuid()) { UserName = "staff", Roles = ["ShopManager"] };

    public SubscriptionTerms Terms(int quantity = 2, int interval = 4, SubscriptionPaymentMethod? method = null) =>
        SubscriptionTerms.Create(quantity, interval, SubscriptionFulfilment.Delivery, AddressId, null, method ?? SubscriptionPaymentMethod.CashOnDelivery);

    /// <summary>An Active subscription for the customer, created at <see cref="Oct1"/> so the first delivery is 4 Oct whatever instant the test then runs at; seeded into the repository.</summary>
    public SubscriptionAggregate AddActive(Guid? customerId = null, Guid? skuId = null, DateOnly? first = null, SubscriptionPaymentMethod? method = null)
    {
        var subscription = new SubscriptionAggregate(Guid.NewGuid());
        subscription.Create(new CreateSubscriptionDto(
            customerId ?? CustomerId, skuId ?? SkuId, "Red lentils", "1 kg", Terms(method: method), first, ClockAt(Oct1), StaffUser(), Guid.NewGuid()));
        Subscriptions.Seed(subscription);
        return subscription;
    }

    public SubscriptionCycleAggregate AddCycle(
        SubscriptionAggregate subscription, DateOnly cycleOn, SubscriptionCycleOrderState? state, DateTimeOffset? processedOn = null, Guid? orderId = null)
    {
        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        if (state is { } s)
            cycle.RecordGenerated(new CycleGeneratedDto(
                cycle.Id, subscription.Id, subscription.CustomerId, cycleOn, subscription.SkuId, 2, SubscriptionFulfilment.Delivery, SubscriptionPaymentMethod.BankTransfer, 0m,
                SubscriptionKeys.IdempotencyKey(subscription.Id, cycleOn), orderId ?? Guid.NewGuid(), "ORD-" + cycleOn.DayNumber, s, null, processedOn ?? Now, StaffUser(), Guid.NewGuid()));
        else
            cycle.RecordFailed(new CycleFailedDto(
                cycle.Id, subscription.Id, subscription.CustomerId, cycleOn, subscription.SkuId, 2, SubscriptionFulfilment.Delivery, SubscriptionPaymentMethod.CashOnDelivery, 0m,
                SubscriptionKeys.IdempotencyKey(subscription.Id, cycleOn), SubscriptionCycleFailureReason.OutOfStock, "StockNoLongerAvailable", processedOn ?? Now, StaffUser(), Guid.NewGuid()));

        Cycles.Seed(cycle);
        return cycle;
    }

    public static string Codes(CommandResponse response) =>
        string.Join(",", response.ValidationResult?.Errors.Select(e => e.ErrorCode) ?? []);
}
