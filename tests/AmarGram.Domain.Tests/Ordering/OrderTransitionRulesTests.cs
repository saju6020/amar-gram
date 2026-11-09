using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Ordering;

/// <summary>HO-ORD-001 §15 U-A5 -- the full (from, action) table is exactly §8.4's arrows (US-ORD-09 AC2, ADR-197).</summary>
public sealed class OrderTransitionRulesTests
{
    private static readonly List<(OrderStatus From, OrderTransitionAction Action, OrderStatus To)> Expected =
    [
        (OrderStatus.PendingPayment, OrderTransitionAction.ConfirmPayment, OrderStatus.Confirmed),
        (OrderStatus.PendingPayment, OrderTransitionAction.Expire, OrderStatus.Cancelled),
        (OrderStatus.PendingPayment, OrderTransitionAction.Cancel, OrderStatus.Cancelled),
        (OrderStatus.Confirmed, OrderTransitionAction.StartPacking, OrderStatus.Packing),
        (OrderStatus.Confirmed, OrderTransitionAction.Cancel, OrderStatus.Cancelled),
        (OrderStatus.Confirmed, OrderTransitionAction.CollectAtCounter, OrderStatus.Delivered),
        (OrderStatus.Packing, OrderTransitionAction.MarkPacked, OrderStatus.Packed),
        (OrderStatus.Packing, OrderTransitionAction.Dispatch, OrderStatus.Dispatched),
        (OrderStatus.Packing, OrderTransitionAction.MarkReadyForCollection, OrderStatus.Dispatched),
        (OrderStatus.Packing, OrderTransitionAction.Cancel, OrderStatus.Cancelled),
        // HO-P4 BG-4: the optional "packed, waiting for rider" step
        (OrderStatus.Packed, OrderTransitionAction.Dispatch, OrderStatus.Dispatched),
        (OrderStatus.Packed, OrderTransitionAction.MarkReadyForCollection, OrderStatus.Dispatched),
        (OrderStatus.Packed, OrderTransitionAction.Cancel, OrderStatus.Cancelled),
        (OrderStatus.Dispatched, OrderTransitionAction.RecordDelivery, OrderStatus.Delivered),
        (OrderStatus.Dispatched, OrderTransitionAction.RecordDeliveryFailure, OrderStatus.Returned),
        (OrderStatus.Delivered, OrderTransitionAction.CompleteReturn, OrderStatus.Returned),
        (OrderStatus.Delivered, OrderTransitionAction.Refund, OrderStatus.Refunded),
        (OrderStatus.Returned, OrderTransitionAction.Refund, OrderStatus.Refunded),
    ];

    [Fact]
    public void U_A5_EveryFromActionPair_IsEitherAnArrowOfAppendixC_OrRefusedNamingTheState()
    {
        foreach (var from in Enumeration.GetAll<OrderStatus>())
        {
            foreach (var action in Enum.GetValues<OrderTransitionAction>())
            {
                var next = OrderTransitionRules.Next(from, action);
                var arrows = Expected.Where(e => e.From == from && e.Action == action).ToList();

                if (arrows.Count == 1)
                {
                    Assert.Equal(arrows[0].To, next);
                    Assert.True(OrderTransitionRules.IsAllowed(from, action));
                    Assert.Equal(arrows[0].To, OrderTransitionRules.Require(from, action));
                }
                else
                {
                    Assert.Null(next);
                    Assert.False(OrderTransitionRules.IsAllowed(from, action));

                    var ex = Assert.Throws<DomainRuleViolationException>(() => OrderTransitionRules.Require(from, action));
                    Assert.Equal(BusinessViolationCodes.InvalidOrderTransition, ex.ErrorCode);
                    Assert.Contains(OrderTransitionRules.StateWords(from), ex.Message);
                    Assert.Contains(OrderTransitionRules.ActionVerb(action), ex.Message);
                }
            }
        }
    }

    [Fact]
    public void U_A5_TheTableHasExactlyTheEighteenArrows_AndNoTenthState()
    {
        Assert.Equal(Expected.Count, OrderTransitionRules.AllTransitions.Count);
        Assert.Equal(18, Expected.Count);
        Assert.Equal(9, Enumeration.GetAll<OrderStatus>().Count()); // Appendix C's eight, plus HO-P4 BG-4's Packed
        Assert.Equal(
            ["PendingPayment", "Confirmed", "Packing", "Dispatched", "Delivered", "Cancelled", "Returned", "Refunded", "Packed"],
            Enumeration.GetAll<OrderStatus>().OrderBy(s => s.Value).Select(s => s.DisplayName));
    }

    [Fact]
    public void TheNamedExample_ADeliveredOrderCannotBePacked()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => OrderTransitionRules.Require(OrderStatus.Delivered, OrderTransitionAction.StartPacking));
        Assert.Equal("A delivered order cannot be packed.", ex.Message);
    }

    [Theory]
    [InlineData(nameof(OrderStatus.Cancelled))]
    [InlineData(nameof(OrderStatus.Refunded))]
    public void TerminalStates_AllowNothing(string state)
    {
        var status = Enumeration.FromDisplayName<OrderStatus>(state);
        Assert.All(Enum.GetValues<OrderTransitionAction>(), a => Assert.False(OrderTransitionRules.IsAllowed(status, a)));
    }

    [Theory]
    [InlineData(nameof(OrderStatus.PendingPayment), true, true)]
    [InlineData(nameof(OrderStatus.Confirmed), true, true)]
    [InlineData(nameof(OrderStatus.Packing), true, false)]   // US-ORD-12 AC2: the customer may not cancel once packing began...
    [InlineData(nameof(OrderStatus.Packing), false, true)]   // ...staff may
    [InlineData(nameof(OrderStatus.Packed), true, false)]    // HO-P4 BG-4: packed is past the point of an online cancel too...
    [InlineData(nameof(OrderStatus.Packed), false, true)]    // ...staff may still cancel
    [InlineData(nameof(OrderStatus.Dispatched), true, false)]
    [InlineData(nameof(OrderStatus.Dispatched), false, false)]
    [InlineData(nameof(OrderStatus.Delivered), false, false)]
    public void Cancel_CustomerBeforePacking_StaffAlsoWhilePacking(string state, bool byCustomer, bool allowed)
    {
        var status = Enumeration.FromDisplayName<OrderStatus>(state);
        Assert.Equal(allowed, OrderTransitionRules.CanCancel(status, byCustomer));
    }

    [Fact]
    public void AnExpiredTransferOrder_IsCancelled_NotANewState() =>
        Assert.Equal(OrderStatus.Cancelled, OrderTransitionRules.Next(OrderStatus.PendingPayment, OrderTransitionAction.Expire));

    [Fact]
    public void InitialStatus_OnlyMoneyFirstMethodsWait()
    {
        Assert.Equal(OrderStatus.Confirmed, OrderTransitionRules.InitialStatus(OrderPaymentMethod.CashOnDelivery));
        Assert.Equal(OrderStatus.Confirmed, OrderTransitionRules.InitialStatus(OrderPaymentMethod.PayOnCollection));
        Assert.Equal(OrderStatus.PendingPayment, OrderTransitionRules.InitialStatus(OrderPaymentMethod.BankTransfer));
        Assert.Equal(OrderStatus.PendingPayment, OrderTransitionRules.InitialStatus(OrderPaymentMethod.InStore));
    }

    [Fact]
    public void AllowedActions_ComeFromTheSameTable_NarrowedByFulfilment()
    {
        var delivery = OrderTransitionRules.AllowedActions(OrderStatus.Packing, FulfilmentMethod.Delivery, OrderPaymentMethod.CashOnDelivery);
        Assert.Contains(OrderTransitionAction.Dispatch, delivery);
        Assert.DoesNotContain(OrderTransitionAction.MarkReadyForCollection, delivery);

        var pickup = OrderTransitionRules.AllowedActions(OrderStatus.Packing, FulfilmentMethod.Pickup, OrderPaymentMethod.PayOnCollection);
        Assert.Contains(OrderTransitionAction.MarkReadyForCollection, pickup);
        Assert.DoesNotContain(OrderTransitionAction.Dispatch, pickup);

        var cod = OrderTransitionRules.AllowedActions(OrderStatus.PendingPayment, FulfilmentMethod.Delivery, OrderPaymentMethod.CashOnDelivery);
        Assert.DoesNotContain(OrderTransitionAction.ConfirmPayment, cod);
    }

    [Fact]
    public void HoP4_Bg4_Packing_OffersMarkPackedBesideDispatch_AndPackedOffersDispatchOrReadyButNotPackedAgain()
    {
        var packing = OrderTransitionRules.AllowedActions(OrderStatus.Packing, FulfilmentMethod.Delivery, OrderPaymentMethod.CashOnDelivery);
        Assert.Contains(OrderTransitionAction.MarkPacked, packing);
        Assert.Contains(OrderTransitionAction.Dispatch, packing); // optional step: the old straight-through path stays

        var packedDelivery = OrderTransitionRules.AllowedActions(OrderStatus.Packed, FulfilmentMethod.Delivery, OrderPaymentMethod.CashOnDelivery);
        Assert.Equal(2, packedDelivery.Count);
        Assert.Contains(OrderTransitionAction.Dispatch, packedDelivery);
        Assert.Contains(OrderTransitionAction.Cancel, packedDelivery);

        var packedPickup = OrderTransitionRules.AllowedActions(OrderStatus.Packed, FulfilmentMethod.Pickup, OrderPaymentMethod.PayOnCollection);
        Assert.Contains(OrderTransitionAction.MarkReadyForCollection, packedPickup);
        Assert.DoesNotContain(OrderTransitionAction.MarkPacked, packedPickup);
        Assert.DoesNotContain(OrderTransitionAction.StartPacking, packedPickup);
    }

    [Fact]
    public void HoP4_Bg4_AConfirmedOrderCannotSkipToPacked_AndThePackedStateIsNamedInTheRefusal()
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => OrderTransitionRules.Require(OrderStatus.Confirmed, OrderTransitionAction.MarkPacked));
        Assert.Equal("A confirmed order cannot be marked as packed.", ex.Message);

        var packed = Assert.Throws<DomainRuleViolationException>(() => OrderTransitionRules.Require(OrderStatus.Packed, OrderTransitionAction.StartPacking));
        Assert.Equal("A packed order cannot be packed.", packed.Message);
    }
}
