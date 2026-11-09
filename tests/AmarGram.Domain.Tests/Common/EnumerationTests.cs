using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Common;

/// <summary>U27 (the foundation handover, section 15).</summary>
public sealed class EnumerationTests
{
    [Fact]
    public void FromValue_ReturnsMatchingMember()
    {
        Assert.Same(ProductStatus.Active, Enumeration.FromValue<ProductStatus>(2));
    }

    [Fact]
    public void FromDisplayName_ReturnsMatchingMember()
    {
        Assert.Same(OrderStatus.Cancelled, Enumeration.FromDisplayName<OrderStatus>("Cancelled"));
    }

    [Fact]
    public void GetAll_ReturnsEveryMember()
    {
        var all = Enumeration.GetAll<ProductStatus>().ToList();

        Assert.Equal(3, all.Count);
        Assert.Contains(ProductStatus.Draft, all);
        Assert.Contains(ProductStatus.Active, all);
        Assert.Contains(ProductStatus.Archived, all);
    }

    [Fact]
    public void Equality_SameValueSameType_AreEqual()
    {
        Assert.Equal(ProductStatus.Draft, Enumeration.FromValue<ProductStatus>(1));
        Assert.True(ProductStatus.Draft == Enumeration.FromValue<ProductStatus>(1));
    }

    [Fact]
    public void FromValue_UnknownValue_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Enumeration.FromValue<ProductStatus>(99));
    }
}
