using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Infrastructure.Fakes.Billing;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Infrastructure.Tests.Fakes.Billing;

public sealed class InMemoryBillableChargeRecorderTests
{
    private static ChargeRequestDto NewRequest(Guid sourceId) => new(
        CustomerId: Guid.NewGuid(),
        BranchId: Guid.NewGuid(),
        BusinessLine: BusinessLine.Shop,
        ItemKind: ItemKind.Product,
        SourceKind: ChargeSourceKind.Order,
        SourceId: sourceId,
        SourceLineRef: "main",
        Description: "Organic honey",
        Quantity: 1m,
        UnitPrice: new Money(500m, "BDT"),
        LineDiscount: Money.Zero("BDT"),
        TaxClassId: Guid.NewGuid(),
        ServiceDate: DateOnly.FromDateTime(DateTime.UtcNow));

    [Fact]
    public async Task RecordAsync_twice_with_the_same_source_key_returns_the_same_id()
    {
        var sut = new InMemoryBillableChargeRecorder();
        var sourceId = Guid.NewGuid();

        var first = await sut.RecordAsync(NewRequest(sourceId));
        var second = await sut.RecordAsync(NewRequest(sourceId));

        Assert.Equal(first, second);
    }

    [Fact]
    public async Task VoidAsync_lets_the_source_key_be_recorded_again_with_a_new_id()
    {
        var sut = new InMemoryBillableChargeRecorder();
        var sourceId = Guid.NewGuid();

        var first = await sut.RecordAsync(NewRequest(sourceId));
        await sut.VoidAsync(new ChargeSourceKey(ChargeSourceKind.Order, sourceId), "cancelled");
        var second = await sut.RecordAsync(NewRequest(sourceId));

        Assert.NotEqual(first, second);
    }
}
