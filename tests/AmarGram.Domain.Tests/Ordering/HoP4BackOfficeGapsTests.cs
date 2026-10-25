using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Order;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Tests.Ordering;

/// <summary>HO-P4 BG-4 (Packed state, pick ticks), BG-5 (in-house riders) and BG-8 (the counter-sale system account) -- the aggregates' own rules.</summary>
public sealed class HoP4BackOfficeGapsTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 25, 8, 0, 0, TimeSpan.Zero);
    private static readonly UserContext Customer = new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["Customer"] };
    private static readonly UserContext Staff = new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["Reception"] };
    private static readonly Guid Corr = Guid.NewGuid();

    private static OrderAggregate Placed(OrderPaymentMethod? method = null, FulfilmentMethod? fulfilment = null)
    {
        var payment = method ?? OrderPaymentMethod.CashOnDelivery;
        var fulfil = fulfilment ?? (payment == OrderPaymentMethod.PayOnCollection ? FulfilmentMethod.Pickup : FulfilmentMethod.Delivery);
        var lines = new List<OrderLineDto>
        {
            new(Guid.NewGuid(), 1, Guid.NewGuid(), Guid.NewGuid(), "Rice", "5 kg", null, ProductReturnClass.Food, false, 2, 850m, 1700m, 0m, 170m, Guid.NewGuid(), 15m, 229.50m, 1759.50m, []),
            new(Guid.NewGuid(), 2, Guid.NewGuid(), Guid.NewGuid(), "Honey", "250 g", null, ProductReturnClass.Food, false, 1, 120m, 120m, 0m, 12m, Guid.NewGuid(), 0m, 0m, 108m, []),
        };

        var order = new OrderAggregate(Guid.NewGuid());
        order.Place(new PlaceOrderDto(
            "ORD-2026-000001", OrderChannel.Online, Customer.UserId, Guid.NewGuid(), fulfil, payment, "BDT",
            new FulfilmentDetails("Rina Akter", "01712345678", "House 1", null, "Dhaka", "Dhaka", "1212", null, null, null, null, null, null, null, null, null),
            lines, new OrderTotals(1820m, 0m, 182m, 60m, 229.50m, 1927.50m), null, null, new string('f', 64), Guid.NewGuid(), T0, Customer, Corr));
        return order;
    }

    private static OrderAggregate Allocated(OrderAggregate order)
    {
        order.RecordAllocations(order.Lines.Select(l => new AllocationDto(l.Id, l.SkuId, Guid.NewGuid(), "LOT-1", Guid.NewGuid(), l.Quantity, null)).ToList());
        return order;
    }

    private static OrderAggregate Packing(FulfilmentMethod? fulfilment = null, OrderPaymentMethod? method = null)
    {
        var order = Allocated(Placed(method, fulfilment));
        order.StartPacking(Staff, T0.AddHours(1), Corr);
        return order;
    }

    private static string CodeOf(Action action) => Assert.Throws<DomainRuleViolationException>(action).ErrorCode;

    // ── BG-4: Packed ─────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void HoP4_Bg4_MarkPacked_MovesPackingToPacked_WithHistoryEventAndInstant()
    {
        var order = Packing();

        order.MarkPacked(Staff, T0.AddHours(2), Corr);

        Assert.Equal(OrderStatus.Packed, order.Status);
        Assert.Equal(T0.AddHours(2), order.PackedOn);
        var last = order.StatusHistory[^1];
        Assert.Equal((OrderStatus.Packing, OrderStatus.Packed, Staff.UserId, T0.AddHours(2)), (last.From!, last.To, last.ChangedBy, last.ChangedOn));
        Assert.Contains(order.Events, e => e is OrderPackedEvent p && p.OrderId == order.Id);
    }

    [Fact]
    public void HoP4_Bg4_MarkPacked_FromAnyOtherState_IsInvalidOrderTransition_NamingTheState()
    {
        var confirmed = Allocated(Placed());
        var ex = Assert.Throws<DomainRuleViolationException>(() => confirmed.MarkPacked(Staff, T0, Corr));
        Assert.Equal(BusinessViolationCodes.InvalidOrderTransition, ex.ErrorCode);
        Assert.Equal("A confirmed order cannot be marked as packed.", ex.Message);

        var packed = Packing();
        packed.MarkPacked(Staff, T0.AddHours(2), Corr);
        Assert.Equal(BusinessViolationCodes.InvalidOrderTransition, CodeOf(() => packed.MarkPacked(Staff, T0.AddHours(3), Corr)));
    }

    [Fact]
    public void HoP4_Bg4_MarkPacked_NeedsEveryLineAllocated()
    {
        var order = Placed();
        order.StartPacking(Staff, T0.AddHours(1), Corr);

        Assert.Equal(BusinessViolationCodes.OrderNotFullyAllocated, CodeOf(() => order.MarkPacked(Staff, T0.AddHours(2), Corr)));
        Assert.Equal(OrderStatus.Packing, order.Status);
    }

    [Fact]
    public void HoP4_Bg4_APackedDeliveryOrder_CanBeDispatched_AndAPackedPickupMarkedReady()
    {
        var delivery = Packing();
        delivery.MarkPacked(Staff, T0.AddHours(2), Corr);
        delivery.Dispatch(new Shipment(Guid.NewGuid(), "Sundarban", null, null, T0.AddHours(3), Staff.UserId, null, null), T0.AddHours(3), Staff, Corr);
        Assert.Equal(OrderStatus.Dispatched, delivery.Status);

        var pickup = Packing(FulfilmentMethod.Pickup, OrderPaymentMethod.PayOnCollection);
        pickup.MarkPacked(Staff, T0.AddHours(2), Corr);
        pickup.MarkReadyForCollection(new DateOnly(2026, 11, 1), T0.AddHours(3), Staff, Corr);
        Assert.Equal(OrderStatus.Dispatched, pickup.Status);
    }

    [Fact]
    public void HoP4_Bg4_PackingMayStillGoStraightToDispatch_PackedIsAnOptionalStep()
    {
        var order = Packing();
        order.Dispatch(new Shipment(Guid.NewGuid(), "Sundarban", null, null, T0.AddHours(2), Staff.UserId, null, null), T0.AddHours(2), Staff, Corr);

        Assert.Equal(OrderStatus.Dispatched, order.Status);
        Assert.Null(order.PackedOn);
    }

    [Fact]
    public void HoP4_Bg4_APackedOrder_StaffMayCancel_TheCustomerMayNot()
    {
        var byCustomer = Packing();
        byCustomer.MarkPacked(Staff, T0.AddHours(2), Corr);
        Assert.Equal(BusinessViolationCodes.CancellationNotAvailable,
            CodeOf(() => byCustomer.Cancel(Customer, byCustomer: true, OrderCancellationReason.CustomerRequest, null, T0.AddHours(3), Corr)));

        var byStaff = Packing();
        byStaff.MarkPacked(Staff, T0.AddHours(2), Corr);
        byStaff.Cancel(Staff, byCustomer: false, OrderCancellationReason.StaffDecision, "Customer called", T0.AddHours(3), Corr);
        Assert.Equal(OrderStatus.Cancelled, byStaff.Status);
    }

    // ── BG-4: pick ticks ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void HoP4_Bg4_SetLinePicked_PersistsTheTick_WithWhoAndWhen_AndUntickClearsIt()
    {
        var order = Allocated(Placed());
        var line = order.Lines[0];

        Assert.True(order.SetLinePicked(line.Id, true, Staff, T0.AddMinutes(5)));
        Assert.True(line.IsPicked);
        Assert.Equal(T0.AddMinutes(5), line.PickedOn);
        Assert.Equal(Staff.UserId, line.PickedBy);
        Assert.False(order.Lines[1].IsPicked);

        Assert.True(order.SetLinePicked(line.Id, false, Staff, T0.AddMinutes(6)));
        Assert.False(line.IsPicked);
        Assert.Null(line.PickedOn);
        Assert.Null(line.PickedBy);
    }

    [Fact]
    public void HoP4_Bg4_SetLinePicked_IsIdempotent_AndOnlyARealChangeMovesTheVersion()
    {
        var order = Allocated(Placed());
        var line = order.Lines[0];

        var before = order.Version;
        Assert.False(order.SetLinePicked(line.Id, false, Staff, T0));       // already unticked
        Assert.Equal(before, order.Version);

        Assert.True(order.SetLinePicked(line.Id, true, Staff, T0));
        var after = order.Version;
        Assert.NotEqual(before, after);

        Assert.False(order.SetLinePicked(line.Id, true, Staff, T0.AddMinutes(1))); // already ticked: keeps the first picker and instant
        Assert.Equal(after, order.Version);
        Assert.Equal(T0, line.PickedOn);
    }

    [Fact]
    public void HoP4_Bg4_SetLinePicked_UnknownLine_IsOrderLineNotFound_AndAnOrderThatLeftTheShelfIsInvalidOrderTransition()
    {
        var order = Allocated(Placed());
        Assert.Equal(BusinessViolationCodes.OrderLineNotFound, CodeOf(() => order.SetLinePicked(Guid.NewGuid(), true, Staff, T0)));

        order.StartPacking(Staff, T0.AddHours(1), Corr);
        order.Dispatch(new Shipment(Guid.NewGuid(), "Sundarban", null, null, T0.AddHours(2), Staff.UserId, null, null), T0.AddHours(2), Staff, Corr);
        Assert.Equal(BusinessViolationCodes.InvalidOrderTransition, CodeOf(() => order.SetLinePicked(order.Lines[0].Id, true, Staff, T0.AddHours(3))));
    }

    [Theory]
    [InlineData(nameof(OrderStatus.Confirmed))]
    [InlineData(nameof(OrderStatus.Packing))]
    [InlineData(nameof(OrderStatus.Packed))]
    public void HoP4_Bg4_SetLinePicked_IsAllowedWhileTheOrderIsBeingPrepared(string state)
    {
        var order = Allocated(Placed());
        if (state != nameof(OrderStatus.Confirmed)) order.StartPacking(Staff, T0.AddHours(1), Corr);
        if (state == nameof(OrderStatus.Packed)) order.MarkPacked(Staff, T0.AddHours(2), Corr);

        Assert.True(order.SetLinePicked(order.Lines[1].Id, true, Staff, T0.AddHours(3)));
    }

    [Fact]
    public void HoP4_Bg4_ThePickTicksNeverGateAnyTransition()
    {
        var order = Packing();
        Assert.All(order.Lines, l => Assert.False(l.IsPicked));

        order.MarkPacked(Staff, T0.AddHours(2), Corr); // nothing ticked: still allowed

        Assert.Equal(OrderStatus.Packed, order.Status);
    }

    // ── BG-5: riders ─────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void HoP4_Bg5_ARiderShipment_NamesTheRider_HasNoCourier_AndShowsTheCustomerAFixedCarrierName()
    {
        var riderId = Guid.NewGuid();
        var shipment = Shipment.ForRider(riderId, "Karim", T0, Staff.UserId);

        Assert.True(shipment.IsRiderDelivery);
        Assert.Null(shipment.CourierId);
        Assert.Equal(riderId, shipment.RiderId);
        Assert.Equal("Karim", shipment.RiderName);
        Assert.Equal(OrderRules.RiderCarrierName, shipment.CourierName);
        Assert.Null(shipment.TrackingNumber);
    }

    [Fact]
    public void HoP4_Bg5_DispatchingToARider_RaisesTheEventWithTheRiderAndNoCourier()
    {
        var order = Packing();
        var riderId = Guid.NewGuid();

        order.Dispatch(Shipment.ForRider(riderId, "Karim", T0.AddHours(2), Staff.UserId), T0.AddHours(2), Staff, Corr);

        Assert.Equal(OrderStatus.Dispatched, order.Status);
        var dispatched = Assert.Single(order.Events.OfType<OrderDispatchedEvent>());
        Assert.Equal(riderId, dispatched.RiderId);
        Assert.Null(dispatched.CourierId);
        Assert.False(dispatched.HasTracking);
    }

    [Fact]
    public void HoP4_Bg5_ACourierDispatch_KeepsItsCourier_AndNoRider()
    {
        var order = Packing();
        var courierId = Guid.NewGuid();

        order.Dispatch(new Shipment(courierId, "Sundarban", "TRK1", null, T0.AddHours(2), Staff.UserId, null, null), T0.AddHours(2), Staff, Corr);

        var dispatched = Assert.Single(order.Events.OfType<OrderDispatchedEvent>());
        Assert.Equal(courierId, dispatched.CourierId);
        Assert.Null(dispatched.RiderId);
        Assert.False(order.Shipment!.IsRiderDelivery);
    }

    [Fact]
    public void HoP4_Bg5_ARiderDelivery_CannotCarryATrackingNumber()
    {
        var order = Packing();
        order.Dispatch(Shipment.ForRider(Guid.NewGuid(), "Karim", T0.AddHours(2), Staff.UserId), T0.AddHours(2), Staff, Corr);

        Assert.Equal(BusinessViolationCodes.InvalidOrderTransition, CodeOf(() => order.RecordTracking("TRK-1", null)));
    }

    [Fact]
    public void HoP4_Bg5_ARider_IsCreatedPerBranch_WithATrimmedNameAndANormalisedMobile()
    {
        var branch = Guid.NewGuid();
        var rider = new RiderAggregate(Guid.NewGuid());

        rider.Create(branch, "  Karim Uddin ", "017 1234-5678", true, Staff);

        Assert.Equal(branch, rider.BranchId);
        Assert.Equal("Karim Uddin", rider.Name);
        Assert.Equal("+8801712345678", rider.MobileNumber);
        Assert.True(rider.IsActive);
    }

    [Fact]
    public void HoP4_Bg5_ARider_MobileIsOptional_NameIsRequired_AndABadNumberIsRefused()
    {
        var rider = new RiderAggregate(Guid.NewGuid());
        rider.Create(Guid.NewGuid(), "Karim", null, true, Staff);
        Assert.Null(rider.MobileNumber);

        Assert.Equal(BusinessViolationCodes.InvalidRider, CodeOf(() => new RiderAggregate(Guid.NewGuid()).Create(Guid.NewGuid(), "  ", null, true, Staff)));
        Assert.Equal(BusinessViolationCodes.InvalidRider, CodeOf(() => new RiderAggregate(Guid.NewGuid()).Create(Guid.NewGuid(), new string('x', OrderRules.MaxNameLength + 1), null, true, Staff)));
        Assert.Equal(BusinessViolationCodes.InvalidRider, CodeOf(() => new RiderAggregate(Guid.NewGuid()).Create(Guid.Empty, "Karim", null, true, Staff)));
        Assert.Equal(BusinessViolationCodes.InvalidMobileNumber, CodeOf(() => rider.Update("Karim", "12345", true)));
    }

    [Fact]
    public void HoP4_Bg5_ARider_CanBeRenamedAndDeactivated_ButKeepsItsBranch()
    {
        var branch = Guid.NewGuid();
        var rider = new RiderAggregate(Guid.NewGuid());
        rider.Create(branch, "Karim", "01712345678", true, Staff);

        rider.Update("Karim U.", null, false);

        Assert.Equal("Karim U.", rider.Name);
        Assert.Null(rider.MobileNumber);
        Assert.False(rider.IsActive);
        Assert.Equal(branch, rider.BranchId);
    }

    // ── BG-8: the counter-sale system account ───────────────────────────────────────────────────────
    private static CustomerAccountAggregate SystemAccount()
    {
        var account = new CustomerAccountAggregate(Guid.NewGuid());
        account.RegisterWalkIn(new WalkInCustomerRegistrationDto(
            AnonymousCounterCustomer.FullName, MobileNumber.Create(AnonymousCounterCustomer.Mobile), TestUserContext.Create(), Guid.NewGuid()));
        return account;
    }

    [Fact]
    public void HoP4_Bg8_TheReservedMobile_NormalisesToTheConstantTheGuardsCompareWith()
    {
        Assert.Equal(AnonymousCounterCustomer.NormalisedMobile, MobileNumber.Create(AnonymousCounterCustomer.Mobile).Value);
        Assert.Equal(AnonymousCounterCustomer.NormalisedMobile, MobileNumber.Create("+880 1000-000000").Value);
        Assert.True(AnonymousCounterCustomer.IsReservedMobile(AnonymousCounterCustomer.NormalisedMobile));
        Assert.False(AnonymousCounterCustomer.IsReservedMobile("+8801712345678"));
    }

    [Fact]
    public void HoP4_Bg8_TheSystemAccount_IsRegisteredThroughTheOrdinaryWalkInPath_UnderItsOneName()
    {
        var account = SystemAccount();

        Assert.True(account.IsCounterSystemAccount);
        Assert.Equal(CustomerAccountStatus.Active, account.Status);
        Assert.Equal(CustomerRecordStatus.Incomplete, account.RecordStatus); // no password, ever
    }

    [Fact]
    public void HoP4_Bg8_NobodyElse_CanRegisterTheReservedNumber()
    {
        // a self-registering customer
        var self = new CustomerAccountAggregate(Guid.NewGuid());
        var selfEx = Assert.Throws<DomainRuleViolationException>(() => self.Register(new CustomerRegistrationDto(
            "Eve", MobileNumber.Create(AnonymousCounterCustomer.Mobile), null, PasswordCredential.Create("hash", "argon2id", DateTimeOffset.UtcNow), TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.InvalidMobileNumber, selfEx.ErrorCode);

        // a staff-registered walk-in under any other name
        var walkIn = new CustomerAccountAggregate(Guid.NewGuid());
        var walkInEx = Assert.Throws<DomainRuleViolationException>(() => walkIn.RegisterWalkIn(new WalkInCustomerRegistrationDto(
            "Eve", MobileNumber.Create(AnonymousCounterCustomer.Mobile), TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.InvalidMobileNumber, walkInEx.ErrorCode);
    }

    [Fact]
    public void HoP4_Bg8_TheSystemAccount_IsFrozen_NoPasswordNoContactEditNoMergeNoErasure()
    {
        var account = SystemAccount();
        var user = TestUserContext.Create();

        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(() => account.SetPassword(new PasswordSetDto(PasswordCredential.Create("hash", "argon2id", DateTimeOffset.UtcNow), user, Guid.NewGuid()))));
        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(() => account.UpdateContactDetails(new CustomerContactDetailsDto("Mallory", null, [], user, Guid.NewGuid()))));
        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(() => account.MergeInto(new CustomerMergeDto(Guid.NewGuid(), "dup", null, [], null, DateTimeOffset.UtcNow, user, Guid.NewGuid()))));
        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(() => account.Anonymise(new CustomerAnonymisationDto(DateTimeOffset.UtcNow, user, Guid.NewGuid()))));
        Assert.Equal(CustomerAccountStatus.Active, account.Status);
        Assert.Equal(AnonymousCounterCustomer.FullName, account.FullName);
    }

    [Fact]
    public void HoP4_Bg8_NoOtherAccount_CanBeMergedIntoTheSystemAccount()
    {
        var customer = new CustomerAccountAggregate(Guid.NewGuid());
        customer.RegisterWalkIn(new WalkInCustomerRegistrationDto("Rina", MobileNumber.Create("01712345678"), TestUserContext.Create(), Guid.NewGuid()));

        var ex = Assert.Throws<DomainRuleViolationException>(() => customer.MergeInto(new CustomerMergeDto(
            Guid.NewGuid(), "dup", MobileNumber.Create(AnonymousCounterCustomer.Mobile), [], null, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.CustomersNotDuplicates, ex.ErrorCode);
        Assert.Equal(CustomerAccountStatus.Active, customer.Status);
    }

    [Fact]
    public void HoP4_Bg8_AnOrdinaryWalkIn_IsUnaffectedByTheGuards()
    {
        var customer = new CustomerAccountAggregate(Guid.NewGuid());
        customer.RegisterWalkIn(new WalkInCustomerRegistrationDto("Rina", MobileNumber.Create("01712345678"), TestUserContext.Create(), Guid.NewGuid()));

        Assert.False(customer.IsCounterSystemAccount);
        customer.UpdateContactDetails(new CustomerContactDetailsDto("Rina Akter", null, [], TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal("Rina Akter", customer.FullName);
    }

    [Fact]
    public void HoP4_Bg8_ACounterOrder_MayHaveNoCustomer_ButAnOnlineOrderMayNot()
    {
        var counter = new OrderAggregate(Guid.NewGuid());
        counter.Place(CounterDto(customerId: null));
        Assert.Null(counter.CustomerId);

        Assert.Throws<InvalidOperationException>(() => new OrderAggregate(Guid.NewGuid()).Place(CounterDto(customerId: null) with { Channel = OrderChannel.Online, Fulfilment = FulfilmentMethod.Delivery, PaymentMethod = OrderPaymentMethod.CashOnDelivery }));
    }

    private static PlaceOrderDto CounterDto(Guid? customerId) => new(
        "ORD-2026-000002", OrderChannel.Counter, customerId, Guid.NewGuid(), FulfilmentMethod.Counter, OrderPaymentMethod.InStore, "BDT",
        new FulfilmentDetails(AnonymousCounterCustomer.RecipientName, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
        [new OrderLineDto(Guid.NewGuid(), 1, Guid.NewGuid(), Guid.NewGuid(), "Rice", "1 kg", null, ProductReturnClass.Food, false, 1, 100m, 100m, 0m, 0m, Guid.NewGuid(), 0m, 0m, 100m, [])],
        new OrderTotals(100m, 0m, 0m, 0m, 0m, 100m), null, null, new string('f', 64), Guid.NewGuid(), T0, Staff, Corr);
}
