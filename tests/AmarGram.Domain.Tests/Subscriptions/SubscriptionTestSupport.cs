using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Tests.Subscriptions;

/// <summary>Shared builders for the HO-SUB-001 domain tests: the commerce zone is Asia/Dhaka (UTC+6) with a 2-day cut-off, as the main branch seeds it.</summary>
internal static class SubscriptionTestSupport
{
    public static readonly UserContext User = new(Guid.NewGuid(), Guid.NewGuid());
    public static readonly Guid Customer = Guid.NewGuid();
    public static readonly Guid Sku = Guid.NewGuid();
    public static readonly Guid Address = Guid.NewGuid();

    public static SubscriptionClock Clock(DateTimeOffset now, int cutoffDays = 2) =>
        SubscriptionClock.Create(now, TimeZoneInfo.FindSystemTimeZoneById("Asia/Dhaka"), cutoffDays);

    /// <summary>1 Oct 2026, 12:00 in Dhaka. Cut-off 2 -> today is 1 Oct, the earliest delivery 4 Oct, and a delivery on 4 Oct locks at 2 Oct 00:00 +06 = 1 Oct 18:00Z.</summary>
    public static readonly DateTimeOffset Oct1 = new(2026, 10, 1, 6, 0, 0, TimeSpan.Zero);

    public static readonly DateTimeOffset Oct1Locked = new(2026, 10, 1, 18, 0, 0, TimeSpan.Zero);

    public static DateOnly D(int month, int day, int year = 2026) => new(year, month, day);

    public static SubscriptionTerms Terms(int quantity = 2, int interval = 4, SubscriptionPaymentMethod? method = null) =>
        SubscriptionTerms.Create(quantity, interval, SubscriptionFulfilment.Delivery, Address, null, method ?? SubscriptionPaymentMethod.CashOnDelivery);

    public static SubscriptionAggregate Active(SubscriptionClock? clock = null, SubscriptionTerms? terms = null, DateOnly? first = null)
    {
        clock ??= Clock(Oct1);
        var subscription = new SubscriptionAggregate(Guid.NewGuid());
        subscription.Create(new CreateSubscriptionDto(Customer, Sku, "Red lentils", "1 kg", terms ?? Terms(), first, clock, User, Guid.NewGuid()));
        return subscription;
    }

    /// <summary>A subscription whose first cycle (22 Sep) has been processed, so <c>LastCycleOn</c> is 22 Sep and the next delivery is 20 Oct (interval 4).</summary>
    public static SubscriptionAggregate WithLastCycleOn22Sep(int interval = 4)
    {
        var september = Clock(new DateTimeOffset(2026, 9, 15, 6, 0, 0, TimeSpan.Zero));
        var subscription = Active(september, Terms(interval: interval), D(9, 22));
        subscription.RecordCycleProcessed(D(9, 22), SubscriptionCycleOutcome.Generated, null, Clock(new DateTimeOffset(2026, 9, 22, 6, 0, 0, TimeSpan.Zero)), User, Guid.NewGuid());
        return subscription;
    }

    public static CycleGeneratedDto Generated(SubscriptionCycleOrderState state, Guid? orderId = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Customer, D(10, 4), Sku, 2, SubscriptionFulfilment.Delivery, SubscriptionPaymentMethod.BankTransfer, 0m,
            "sub:key", orderId ?? Guid.NewGuid(), "ORD-1", state, null, Oct1, User, Guid.NewGuid());
}
