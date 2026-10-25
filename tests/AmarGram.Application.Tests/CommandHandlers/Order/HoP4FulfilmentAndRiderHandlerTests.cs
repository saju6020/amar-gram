using AmarGram.Application.CommandHandlers.Order;
using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Order;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Tests.CommandHandlers.Order;

/// <summary>
/// HO-P4 BG-4 (packed state, pick ticks) and BG-5 (rider registry, dispatch target) -- the handlers' orchestration with in-memory repositories. Everything past the first
/// business refusal (Inventory's batch check, the notification) is exercised end to end by the integration tests, so those ports are left null here.
/// </summary>
public sealed class HoP4FulfilmentAndRiderHandlerTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 25, 8, 0, 0, TimeSpan.Zero);
    private static readonly UserContext Staff = new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["Reception"] };
    private static readonly Guid BranchId = Guid.NewGuid();
    private static readonly FakeTimeProvider Clock = new(T0.AddHours(2));

    private static string[] Codes(CommandResponse response) => response.ValidationResult?.Errors.Select(e => e.ErrorCode).ToArray() ?? [];

    private static OrderAggregate PlacedOrder(Guid? branchId = null, bool allocated = true, bool packing = true)
    {
        var lines = new List<OrderLineDto>
        {
            new(Guid.NewGuid(), 1, Guid.NewGuid(), Guid.NewGuid(), "Rice", "5 kg", null, ProductReturnClass.Food, false, 2, 850m, 1700m, 0m, 170m, Guid.NewGuid(), 15m, 229.50m, 1759.50m, []),
            new(Guid.NewGuid(), 2, Guid.NewGuid(), Guid.NewGuid(), "Honey", "250 g", null, ProductReturnClass.Food, false, 1, 120m, 120m, 0m, 12m, Guid.NewGuid(), 0m, 0m, 108m, []),
        };

        var order = new OrderAggregate(Guid.NewGuid());
        order.Place(new PlaceOrderDto(
            "ORD-2026-000001", OrderChannel.Online, Guid.NewGuid(), branchId ?? BranchId, FulfilmentMethod.Delivery, OrderPaymentMethod.CashOnDelivery, "BDT",
            new FulfilmentDetails("Rina Akter", "01712345678", "House 1", null, "Dhaka", "Dhaka", "1212", null, null, null, null, null, null, null, null, null),
            lines, new OrderTotals(1820m, 0m, 182m, 60m, 229.50m, 1927.50m), null, null, new string('f', 64), Guid.NewGuid(), T0, Staff, Guid.NewGuid()));

        if (allocated)
            order.RecordAllocations(order.Lines.Select(l => new AllocationDto(l.Id, l.SkuId, Guid.NewGuid(), "LOT-1", Guid.NewGuid(), l.Quantity, null)).ToList());
        if (packing) order.StartPacking(Staff, T0.AddHours(1), Guid.NewGuid());
        return order;
    }

    private static FakeAggregateRootRepository<OrderAggregate> Orders(params OrderAggregate[] orders)
    {
        var repository = new FakeAggregateRootRepository<OrderAggregate>();
        foreach (var order in orders) repository.Seed(order);
        return repository;
    }

    private static RiderAggregate Rider(Guid? branchId = null, string name = "Karim", bool active = true)
    {
        var rider = new RiderAggregate(Guid.NewGuid());
        rider.Create(branchId ?? BranchId, name, null, active, Staff);
        return rider;
    }

    private static FakeAggregateRootRepository<RiderAggregate> Riders(params RiderAggregate[] riders)
    {
        var repository = new FakeAggregateRootRepository<RiderAggregate>();
        foreach (var rider in riders) repository.Seed(rider);
        return repository;
    }

    // ── BG-4: MarkOrderPackedCommandHandler ─────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg4_MarkPacked_MovesThePackingOrder_AndSavesIt()
    {
        var order = PlacedOrder();
        var repository = Orders(order);

        var response = await new MarkOrderPackedCommandHandler(repository, Clock).HandleAsync(
            new MarkOrderPackedCommand { OrderId = order.Id, BranchId = BranchId, UserContext = Staff, CorrelationId = Guid.NewGuid() });

        Assert.True(response.IsSuccess);
        Assert.Equal(OrderStatus.Packed, order.Status);
        Assert.Same(order, Assert.Single(repository.Updated));
    }

    [Fact]
    public async Task HoP4_Bg4_MarkPacked_RefusesWhatIsNotPacking_AndAnOrderOfAnotherBranchIsNotFound()
    {
        var confirmed = PlacedOrder(packing: false);
        var repository = Orders(confirmed);
        var handler = new MarkOrderPackedCommandHandler(repository, Clock);

        var early = await handler.HandleAsync(new MarkOrderPackedCommand { OrderId = confirmed.Id, BranchId = BranchId, UserContext = Staff, CorrelationId = Guid.NewGuid() });
        Assert.Equal([BusinessViolationCodes.InvalidOrderTransition], Codes(early));
        Assert.Empty(repository.Updated);

        var elsewhere = await handler.HandleAsync(new MarkOrderPackedCommand { OrderId = confirmed.Id, BranchId = Guid.NewGuid(), UserContext = Staff, CorrelationId = Guid.NewGuid() });
        Assert.Equal([BusinessViolationCodes.OrderNotFound], Codes(elsewhere));
    }

    [Fact]
    public async Task HoP4_Bg4_MarkPacked_NeedsEveryLineAllocated()
    {
        var order = PlacedOrder(allocated: false);
        var repository = Orders(order);

        var response = await new MarkOrderPackedCommandHandler(repository, Clock).HandleAsync(
            new MarkOrderPackedCommand { OrderId = order.Id, BranchId = BranchId, UserContext = Staff, CorrelationId = Guid.NewGuid() });

        Assert.Equal([BusinessViolationCodes.OrderNotFullyAllocated], Codes(response));
        Assert.Equal(OrderStatus.Packing, order.Status);
    }

    // ── BG-4: SetOrderLinePickedCommandHandler ─────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg4_Pick_TicksALine_AndOnlyARealChangeIsSaved()
    {
        var order = PlacedOrder(packing: false);
        var repository = Orders(order);
        var handler = new SetOrderLinePickedCommandHandler(repository, Clock);
        var lineId = order.Lines[0].Id;

        SetOrderLinePickedCommand Command(bool picked) => new() { OrderId = order.Id, BranchId = BranchId, LineId = lineId, Picked = picked, UserContext = Staff, CorrelationId = Guid.NewGuid() };

        Assert.True((await handler.HandleAsync(Command(true))).IsSuccess);
        Assert.True(order.Lines[0].IsPicked);
        Assert.Single(repository.Updated);

        Assert.True((await handler.HandleAsync(Command(true))).IsSuccess);          // the same tick again: success, nothing saved
        Assert.Single(repository.Updated);

        Assert.True((await handler.HandleAsync(Command(false))).IsSuccess);
        Assert.False(order.Lines[0].IsPicked);
        Assert.Equal(2, repository.Updated.Count);
    }

    [Fact]
    public async Task HoP4_Bg4_Pick_UnknownLine_AndUnknownOrder_AreNotFound()
    {
        var order = PlacedOrder();
        var handler = new SetOrderLinePickedCommandHandler(Orders(order), Clock);

        var line = await handler.HandleAsync(new SetOrderLinePickedCommand { OrderId = order.Id, BranchId = BranchId, LineId = Guid.NewGuid(), Picked = true, UserContext = Staff, CorrelationId = Guid.NewGuid() });
        Assert.Equal([BusinessViolationCodes.OrderLineNotFound], Codes(line));

        var missing = await handler.HandleAsync(new SetOrderLinePickedCommand { OrderId = Guid.NewGuid(), BranchId = BranchId, LineId = order.Lines[0].Id, Picked = true, UserContext = Staff, CorrelationId = Guid.NewGuid() });
        Assert.Equal([BusinessViolationCodes.OrderNotFound], Codes(missing));
    }

    // ── BG-5: the rider registry ────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task HoP4_Bg5_CreateRider_SavesIt_AndTheNameIsUniqueOnlyWithinTheBranch()
    {
        var repository = Riders(Rider(name: "Karim"));
        var handler = new CreateRiderCommandHandler(repository);

        CreateRiderCommand Command(Guid branch, string name) => new() { RiderId = Guid.NewGuid(), BranchId = branch, Name = name, MobileNumber = "01712345678", UserContext = Staff, CorrelationId = Guid.NewGuid() };

        var duplicate = await handler.HandleAsync(Command(BranchId, " Karim "));
        Assert.Equal([BusinessViolationCodes.RiderNameAlreadyExists], Codes(duplicate));
        Assert.Empty(repository.Saved);

        var otherBranch = await handler.HandleAsync(Command(Guid.NewGuid(), "Karim"));
        Assert.True(otherBranch.IsSuccess);

        var fresh = await handler.HandleAsync(Command(BranchId, "Rahim"));
        Assert.True(fresh.IsSuccess);
        Assert.Equal("+8801712345678", repository.Saved[^1].MobileNumber);
        Assert.Equal(2, repository.Saved.Count);
    }

    [Fact]
    public async Task HoP4_Bg5_CreateRider_ABadMobileIsTheAggregatesRefusal_NothingIsSaved()
    {
        var repository = Riders();

        var response = await new CreateRiderCommandHandler(repository).HandleAsync(
            new CreateRiderCommand { RiderId = Guid.NewGuid(), BranchId = BranchId, Name = "Karim", MobileNumber = "12345", UserContext = Staff, CorrelationId = Guid.NewGuid() });

        Assert.Equal([BusinessViolationCodes.InvalidMobileNumber], Codes(response));
        Assert.Empty(repository.Saved);
    }

    [Fact]
    public async Task HoP4_Bg5_UpdateRider_RenamesAndDeactivates_ButOnlyARiderOfTheCallersBranch()
    {
        var karim = Rider(name: "Karim");
        var rahim = Rider(name: "Rahim");
        var foreign = Rider(Guid.NewGuid(), "Foreign");
        var repository = Riders(karim, rahim, foreign);
        var handler = new UpdateRiderCommandHandler(repository);

        UpdateRiderCommand Command(Guid id, string name, bool active = true) => new() { RiderId = id, BranchId = BranchId, Name = name, IsActive = active, UserContext = Staff, CorrelationId = Guid.NewGuid() };

        Assert.Equal([BusinessViolationCodes.RiderNotFound], Codes(await handler.HandleAsync(Command(foreign.Id, "Hijack"))));
        Assert.Equal([BusinessViolationCodes.RiderNotFound], Codes(await handler.HandleAsync(Command(Guid.NewGuid(), "Nobody"))));
        Assert.Equal([BusinessViolationCodes.RiderNameAlreadyExists], Codes(await handler.HandleAsync(Command(karim.Id, "Rahim"))));
        Assert.Equal("Karim", karim.Name);

        Assert.True((await handler.HandleAsync(Command(karim.Id, "Karim", active: false))).IsSuccess);   // keeping its own name is not a duplicate
        Assert.False(karim.IsActive);
        Assert.Equal("Foreign", foreign.Name);
    }

    // ── BG-5: dispatch target ──────────────────────────────────────────────────────────────────────
    private static DispatchOrderCommandHandler DispatchHandler(OrderAggregate order, params RiderAggregate[] riders) =>
        new(Orders(order), new FakeAggregateRootRepository<CourierAggregate>(), Riders(riders), null!, null!, null!, Clock);

    private static DispatchOrderCommand Dispatch(OrderAggregate order, Guid? courierId = null, Guid? riderId = null, string? tracking = null) =>
        new() { OrderId = order.Id, BranchId = BranchId, CourierId = courierId, RiderId = riderId, TrackingNumber = tracking, UserContext = Staff, CorrelationId = Guid.NewGuid() };

    [Fact]
    public async Task HoP4_Bg5_Dispatch_NeedsExactlyOneOfCourierAndRider()
    {
        var order = PlacedOrder();
        var rider = Rider();
        var handler = DispatchHandler(order, rider);

        Assert.Equal([BusinessViolationCodes.DispatchTargetInvalid], Codes(await handler.HandleAsync(Dispatch(order))));
        Assert.Equal([BusinessViolationCodes.DispatchTargetInvalid], Codes(await handler.HandleAsync(Dispatch(order, courierId: Guid.NewGuid(), riderId: rider.Id))));
        Assert.Equal(OrderStatus.Packing, order.Status);
    }

    [Fact]
    public async Task HoP4_Bg5_Dispatch_ToAnInactiveUnknownOrForeignRider_IsRiderNotFound_AndTheOrderStaysPacking()
    {
        var order = PlacedOrder();
        var inactive = Rider(name: "Inactive", active: false);
        var foreign = Rider(Guid.NewGuid(), "Foreign");
        var handler = DispatchHandler(order, inactive, foreign);

        foreach (var riderId in new[] { inactive.Id, foreign.Id, Guid.NewGuid() })
            Assert.Equal([BusinessViolationCodes.RiderNotFound], Codes(await handler.HandleAsync(Dispatch(order, riderId: riderId))));

        Assert.Equal(OrderStatus.Packing, order.Status);
        Assert.Null(order.Shipment);
    }

    [Fact]
    public async Task HoP4_Bg5_Dispatch_ToAnUnknownCourier_IsStillCourierNotFound()
    {
        var order = PlacedOrder();

        Assert.Equal([BusinessViolationCodes.CourierNotFound], Codes(await DispatchHandler(order).HandleAsync(Dispatch(order, courierId: Guid.NewGuid()))));
    }

    // ── validators ─────────────────────────────────────────────────────────────────────────────────
    [Theory]
    [InlineData(true, false, null, true)]
    [InlineData(false, true, null, true)]
    [InlineData(false, true, "  ", true)]
    [InlineData(true, true, null, false)]       // both
    [InlineData(false, false, null, false)]     // neither
    [InlineData(false, true, "TRK-1", false)]   // a rider delivery has no tracking number
    [InlineData(true, false, "TRK-1", true)]
    public void HoP4_Bg5_TheDispatchValidator_WantsExactlyOneTarget_AndNoTrackingForARider(bool courier, bool rider, string? tracking, bool valid)
    {
        var command = new DispatchOrderCommand
        {
            OrderId = Guid.NewGuid(), BranchId = BranchId, CourierId = courier ? Guid.NewGuid() : null, RiderId = rider ? Guid.NewGuid() : null, TrackingNumber = tracking,
            UserContext = Staff, CorrelationId = Guid.NewGuid(),
        };

        var result = new DispatchOrderCommandValidator().Validate(command);

        Assert.Equal(valid, result.IsValid);
        if (!valid) Assert.Contains(result.Errors, e => e.ErrorCode == BusinessViolationCodes.DispatchTargetInvalid);
    }

    [Fact]
    public void HoP4_Bg5_TheRiderValidators_ChecksShapeOnly()
    {
        var good = new CreateRiderCommand { RiderId = Guid.NewGuid(), BranchId = BranchId, Name = "Karim", MobileNumber = "01712345678", UserContext = Staff, CorrelationId = Guid.NewGuid() };
        Assert.True(new CreateRiderCommandValidator().Validate(good).IsValid);

        Assert.False(new CreateRiderCommandValidator().Validate(new CreateRiderCommand { RiderId = good.RiderId, BranchId = BranchId, Name = "", UserContext = Staff, CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new CreateRiderCommandValidator().Validate(new CreateRiderCommand { RiderId = good.RiderId, BranchId = BranchId, Name = new string('x', 101), UserContext = Staff, CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new CreateRiderCommandValidator().Validate(new CreateRiderCommand { RiderId = good.RiderId, BranchId = BranchId, Name = "Bad\u0007Name", UserContext = Staff, CorrelationId = Guid.NewGuid() }).IsValid);
        Assert.False(new UpdateRiderCommandValidator().Validate(new UpdateRiderCommand { RiderId = Guid.Empty, BranchId = BranchId, Name = "Karim", UserContext = Staff, CorrelationId = Guid.NewGuid() }).IsValid);
    }

    [Theory]
    [InlineData("Rina", "01712345678", true)]
    [InlineData("", "", true)]                 // HO-P4 BG-8: neither = an anonymous sale
    [InlineData("  ", "  ", true)]
    [InlineData("Rina", "", false)]            // one without the other is not
    [InlineData("", "01712345678", false)]
    public void HoP4_Bg8_TheCounterSaleValidator_WantsTheBuyersDetailsTogetherOrNotAtAll(string name, string mobile, bool valid)
    {
        var command = new CompleteCounterSaleCommand
        {
            OrderId = Guid.NewGuid(), IdempotencyKey = Guid.NewGuid(), BranchId = BranchId, CustomerName = name, CustomerMobile = mobile,
            Lines = [new CounterSaleLineInput(Guid.NewGuid(), 1)], Tenders = [new CounterTenderInput(TenderMethod.Cash, 100m, null)], UserContext = Staff, CorrelationId = Guid.NewGuid(),
        };

        Assert.Equal(valid, new CompleteCounterSaleCommandValidator().Validate(command).IsValid);
    }
}
