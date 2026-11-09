using AmarGram.Infrastructure.Billing.Documents;

namespace AmarGram.Infrastructure.Tests.Billing;

/// <summary>Owner decision 2026-11-09 -- the invoice PDF names the subscription discount on the line that carries it.</summary>
public sealed class InvoicePdfLineDetailTests
{
    private static DocumentLine Line(decimal discount, string? label, decimal loyalty = 0m) =>
        new(1, "Shop", "Product", "Dry food", 2m, 850m, discount, loyalty, "STD", 15m, 1530m, 229.5m, 1759.5m, label);

    [Fact]
    public void ALabelledDiscount_IsPrintedWithItsName() =>
        Assert.Equal("Product · Subscription discount (10%) BDT 18.00", BillingPdf.LineDetail(Line(18m, "Subscription discount (10%)"), "BDT"));

    [Fact]
    public void AnUnlabelledDiscount_IsPrintedAsBefore() =>
        Assert.Equal("Product · discount BDT 18.00", BillingPdf.LineDetail(Line(18m, null), "BDT"));

    [Fact]
    public void ALabelWithoutADiscountAmount_IsNotPrinted_AndLoyaltyStaysSeparate()
    {
        Assert.Equal("Product", BillingPdf.LineDetail(Line(0m, "Subscription discount (10%)"), "BDT"));
        Assert.Equal("Product · Subscription discount (10%) BDT 18.00 · loyalty BDT 3.00", BillingPdf.LineDetail(Line(18m, "Subscription discount (10%)", 3m), "BDT"));
    }
}
