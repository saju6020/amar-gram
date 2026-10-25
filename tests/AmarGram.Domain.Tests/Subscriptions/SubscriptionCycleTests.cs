using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using static AmarGram.Domain.Tests.Subscriptions.SubscriptionTestSupport;
using State = AmarGram.Shared.Common.Enums.SubscriptionCycleOrderState;

namespace AmarGram.Domain.Tests.Subscriptions;

/// <summary>HO-SUB-001 §15 D -- what a processed cycle records, how Orders' outcome is mirrored onto it (ADR-243), the unpaid streak (US-SUB-06) and the refusal mapping.</summary>
public sealed class SubscriptionCycleTests
{
    private static SubscriptionCycleAggregate GeneratedCycle(State state)
    {
        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        cycle.RecordGenerated(Generated(state));
        return cycle;
    }

    private static StreakCycle Row(State? state, SubscriptionCycleOutcome? outcome = null) =>
        new(outcome ?? (state is null ? SubscriptionCycleOutcome.Failed : SubscriptionCycleOutcome.Generated), state);

    // ── the cycle record ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void RecordGenerated_KeepsTheOrderIdAndNumber_AndRaisesTheEvent()
    {
        var orderId = Guid.NewGuid();
        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        cycle.RecordGenerated(Generated(State.AwaitingPayment, orderId) with { OrderNumber = new string('N', 60), PaymentExpiresOn = Oct1.AddHours(48), DiscountPercent = 10m });

        Assert.Equal(SubscriptionCycleOutcome.Generated, cycle.Outcome);
        Assert.Equal(orderId, cycle.OrderId);
        Assert.Equal(40, cycle.OrderNumber!.Length);
        Assert.Equal(State.AwaitingPayment, cycle.OrderState);
        Assert.Equal(Oct1.AddHours(48), cycle.PaymentExpiresOn);
        Assert.Equal(10m, cycle.DiscountPercent);
        var generated = Assert.Single(cycle.Events.OfType<SubscriptionOrderGeneratedEvent>());
        Assert.Equal(orderId, generated.OrderId);
        Assert.Equal(cycle.Id, generated.CycleId);
    }

    [Fact]
    public void RecordFailed_KeepsTheReasonAndTheRawCode_Truncated()
    {
        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        var generated = Generated(State.Confirmed);
        cycle.RecordFailed(new CycleFailedDto(
            cycle.Id, generated.SubscriptionId, Customer, D(10, 4), Sku, 2, SubscriptionFulfilment.Delivery, SubscriptionPaymentMethod.CashOnDelivery, 0m, "sub:key",
            SubscriptionCycleFailureReason.OutOfStock, new string('c', 150), Oct1, User, Guid.NewGuid()));

        Assert.Equal(SubscriptionCycleOutcome.Failed, cycle.Outcome);
        Assert.Equal(SubscriptionCycleFailureReason.OutOfStock, cycle.FailureReason);
        Assert.Equal(100, cycle.FailureCode!.Length);
        Assert.Null(cycle.OrderId);
        Assert.Null(cycle.OrderState);
        Assert.Single(cycle.Events.OfType<SubscriptionCycleFailedEvent>());
    }

    // ── mirroring Orders' outcome ────────────────────────────────────────────────────────────────

    [Fact]
    public void U_D1_AMirroredStateRedelivered_RaisesNoEvent_AndDoesNotBumpTheVersion()
    {
        var cycle = GeneratedCycle(State.AwaitingPayment);
        Assert.True(cycle.RecordOrderState(State.Confirmed, Oct1, User, Guid.NewGuid()));
        var version = cycle.Version;
        var events = cycle.Events.Count;

        Assert.False(cycle.RecordOrderState(State.Confirmed, Oct1.AddMinutes(5), User, Guid.NewGuid()));

        Assert.Equal(version, cycle.Version);
        Assert.Equal(events, cycle.Events.Count);
        Assert.Equal(Oct1, cycle.OrderStateChangedOn);
    }

    [Fact]
    public void U_D2_ATransitionOutsideTheTable_IsIgnored_TheStateIsUnchanged()
    {
        var cycle = GeneratedCycle(State.AwaitingPayment);

        Assert.False(cycle.RecordOrderState(State.Delivered, Oct1, User, Guid.NewGuid()));   // skipping Confirmed
        Assert.False(cycle.RecordOrderState(State.Refused, Oct1, User, Guid.NewGuid()));

        Assert.Equal(State.AwaitingPayment, cycle.OrderState);
        Assert.DoesNotContain(cycle.Events, e => e is SubscriptionCycleOrderStateChangedEvent);
    }

    public static IEnumerable<object[]> AllPairs() =>
        from f in Enumeration.GetAll<State>()
        from t in Enumeration.GetAll<State>()
        select new object[] { f.DisplayName, t.DisplayName };

    /// <summary>Only AwaitingPayment to Confirmed, Expired or Cancelled and Confirmed to Delivered, Cancelled or Refused are accepted (§8.7); everything else is ignored.</summary>
    [Theory]
    [MemberData(nameof(AllPairs))]
    public void TheMirror_AcceptsExactlyTheListedTransitions(string fromName, string toName)
    {
        var from = Enumeration.FromDisplayName<State>(fromName);
        var to = Enumeration.FromDisplayName<State>(toName);
        var expected = (from == State.AwaitingPayment && (to == State.Confirmed || to == State.Expired || to == State.Cancelled))
            || (from == State.Confirmed && (to == State.Delivered || to == State.Cancelled || to == State.Refused));

        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        cycle.RecordGenerated(Generated(from));

        Assert.Equal(expected, SubscriptionCycleAggregate.IsAllowed(from, to));
        Assert.Equal(expected, cycle.RecordOrderState(to, Oct1, User, Guid.NewGuid()));
        Assert.Equal(expected ? to : from, cycle.OrderState);
    }

    [Fact]
    public void AFailedCycle_NeverTakesAnOrderState()
    {
        var cycle = new SubscriptionCycleAggregate(Guid.NewGuid());
        cycle.RecordFailed(new CycleFailedDto(
            cycle.Id, Guid.NewGuid(), Customer, D(10, 4), Sku, 2, SubscriptionFulfilment.Delivery, SubscriptionPaymentMethod.CashOnDelivery, 0m, "k",
            SubscriptionCycleFailureReason.OrderRefused, "X", Oct1, User, Guid.NewGuid()));

        Assert.False(cycle.RecordOrderState(State.Confirmed, Oct1, User, Guid.NewGuid()));
    }

    [Fact]
    public void AMerge_MovesTheCycleToTheSurvivor_Idempotently()
    {
        var survivor = Guid.NewGuid();
        var cycle = GeneratedCycle(State.Confirmed);

        Assert.True(cycle.ReassignCustomer(survivor));
        Assert.False(cycle.ReassignCustomer(survivor));
        Assert.Equal(survivor, cycle.CustomerId);
    }

    // ── the unpaid streak ────────────────────────────────────────────────────────────────────────

    [Fact]
    public void U_D3_TheStreak_SkipsACycleStillAwaitingPayment_AndStopsAtAPaidOne()
    {
        Assert.Equal(2, UnpaidCycleRule.Streak([Row(State.AwaitingPayment), Row(State.Expired), Row(State.Expired), Row(State.Confirmed)]));
    }

    [Fact]
    public void U_D4_TheStreak_IgnoresFailedCycles_AndCountsARefusedParcelAsUnpaid()
    {
        Assert.Equal(2, UnpaidCycleRule.Streak([Row(State.Expired), Row(null), Row(State.Refused), Row(State.Delivered)]));
    }

    [Fact]
    public void U_D5_TheStreak_IgnoresACancelledOrder()
    {
        Assert.Equal(2, UnpaidCycleRule.Streak([Row(State.Expired), Row(State.Cancelled), Row(State.Expired)]));
    }

    [Fact]
    public void U_D6_APaidCycle_EndsTheStreak()
    {
        Assert.Equal(0, UnpaidCycleRule.Streak([Row(State.Confirmed), Row(State.Expired), Row(State.Expired)]));
        Assert.Equal(0, UnpaidCycleRule.Streak([Row(State.Delivered), Row(State.Expired)]));
        Assert.Equal(0, UnpaidCycleRule.Streak([]));
    }

    [Fact]
    public void TheStreak_OnlyUnpaidStatesCount()
    {
        Assert.True(UnpaidCycleRule.IsUnpaid(State.Expired));
        Assert.True(UnpaidCycleRule.IsUnpaid(State.Refused));
        Assert.All(new[] { State.AwaitingPayment, State.Confirmed, State.Cancelled, State.Delivered }, s => Assert.False(UnpaidCycleRule.IsUnpaid(s)));
        Assert.False(UnpaidCycleRule.IsUnpaid(null));
        Assert.True(GeneratedCycle(State.Expired).IsUnpaid);
    }

    // ── the refusal mapping ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(nameof(BusinessViolationCodes.StockNoLongerAvailable), nameof(SubscriptionCycleFailureReason.OutOfStock))]
    [InlineData(nameof(BusinessViolationCodes.InsufficientStock), nameof(SubscriptionCycleFailureReason.OutOfStock))]
    [InlineData(nameof(BusinessViolationCodes.SkuUnavailable), nameof(SubscriptionCycleFailureReason.OutOfStock))]
    [InlineData(nameof(BusinessViolationCodes.SkuNotPurchasable), nameof(SubscriptionCycleFailureReason.ProductUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.PaymentMethodUnavailable), nameof(SubscriptionCycleFailureReason.PaymentMethodUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.AddressOutsideServedZones), nameof(SubscriptionCycleFailureReason.DeliveryUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.PickupBranchUnavailable), nameof(SubscriptionCycleFailureReason.DeliveryUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.ServiceLevelUnavailable), nameof(SubscriptionCycleFailureReason.DeliveryUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.DeliveryTaxNotConfigured), nameof(SubscriptionCycleFailureReason.DeliveryUnavailable))]
    [InlineData(nameof(BusinessViolationCodes.DeliveryAddressNotFound), nameof(SubscriptionCycleFailureReason.DeliveryAddressMissing))]
    [InlineData("SomethingOrdersInventedLater", nameof(SubscriptionCycleFailureReason.OrderRefused))]
    [InlineData("", nameof(SubscriptionCycleFailureReason.OrderRefused))]
    public void U_D7_TheClassifier_MapsOrdersRefusals(string code, string expectedReason)
    {
        Assert.Equal(expectedReason, SubscriptionFailureClassifier.Classify(code).DisplayName);
        Assert.Equal(SubscriptionCycleFailureReason.OrderRefused, SubscriptionFailureClassifier.Classify(null));
    }

    [Fact]
    public void OnlyAnUnavailableProduct_SuspendsTheSubscription()
    {
        foreach (var reason in Enumeration.GetAll<SubscriptionCycleFailureReason>())
        {
            var suspension = SubscriptionFailureClassifier.SuspensionFor(reason);
            Assert.Equal(reason == SubscriptionCycleFailureReason.ProductUnavailable ? SubscriptionSuspensionReason.ProductUnavailable : null, suspension);
        }
    }
}
