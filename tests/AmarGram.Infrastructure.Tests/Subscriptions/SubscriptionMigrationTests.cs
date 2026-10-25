using AmarGram.Infrastructure.Persistence.Migrations;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace AmarGram.Infrastructure.Tests.Subscriptions;

/// <summary>
/// HO-SUB-001 §12.1 and §15 U-X3 -- the baseline migration creates both Subscriptions tables in their own <c>subscription</c> schema with every index of the spec, and the status
/// values in the filtered "one live subscription per customer and SKU" index are the enumeration's own <c>Value</c>s, written from the enumeration in configuration code, never
/// typed as literals. Adapted: with the cat retired the live index is on <c>(customer_id, sku_id)</c>, so it needs no <c>NULLS NOT DISTINCT</c> (V1 no longer applies).
/// </summary>
public sealed class SubscriptionMigrationTests
{
    private static IReadOnlyList<CreateIndexOperation> Indexes() =>
        new InitialAmarGram().UpOperations.OfType<CreateIndexOperation>().Where(i => i.Schema == "subscription").ToList();

    [Fact]
    public void I_A1_BothTablesAreCreated_InTheSubscriptionSchema()
    {
        var tables = new InitialAmarGram().UpOperations.OfType<CreateTableOperation>().Where(t => t.Schema == "subscription").Select(t => t.Name).OrderBy(n => n);

        Assert.Equal(["subscription", "subscription_cycle"], tables);
    }

    [Fact]
    public void U_X3_TheLiveSubscriptionIndex_IsUniqueAndFilteredByTheEnumerationValues()
    {
        var live = Indexes().Single(i => i.Name == "ix_subscription_live_per_sku");

        Assert.True(live.IsUnique);
        Assert.Equal(["customer_id", "sku_id"], live.Columns);
        Assert.Equal($"status IN ({SubscriptionStatus.Active.Value}, {SubscriptionStatus.Paused.Value}, {SubscriptionStatus.Suspended.Value})", live.Filter);
    }

    [Fact]
    public void TheCycleIndexes_MakeOneCyclePerDate_AndOneCyclePerOrder()
    {
        var perDate = Indexes().Single(i => i.Name == "ix_subscription_cycle_per_date");
        Assert.True(perDate.IsUnique);
        Assert.Equal(["subscription_id", "cycle_on"], perDate.Columns);

        var perOrder = Indexes().Single(i => i.Name == "ix_subscription_cycle_order");
        Assert.True(perOrder.IsUnique);
        Assert.Equal("order_id IS NOT NULL", perOrder.Filter);
    }

    [Fact]
    public void TheWorkerAndReadIndexes_Exist()
    {
        var names = Indexes().Select(i => i.Name).ToHashSet();

        Assert.Contains("ix_subscription_status_next_delivery", names);   // the due and notice passes
        Assert.Contains("ix_subscription_customer_status", names);        // "my subscriptions" and the live count
        Assert.Contains("ix_subscription_status_suspension", names);      // the staff lists
        Assert.Contains("ix_subscription_cycle_customer", names);         // merge and history
    }

    [Fact]
    public void NoSubscriptionColumn_IsAPaymentTokenCardOrGatewayReference_ADR238()
    {
        var columns = new InitialAmarGram().UpOperations.OfType<CreateTableOperation>().Where(t => t.Schema == "subscription").SelectMany(t => t.Columns).Select(c => c.Name);

        Assert.DoesNotContain(columns, c => System.Text.RegularExpressions.Regex.IsMatch(c, "card|token|mandate|gateway|auto_charge|cvv", System.Text.RegularExpressions.RegexOptions.IgnoreCase));
    }

    [Fact]
    public void TheMoneyFreeCycle_HoldsOnlyThePercentDiscount_NoAmountOrOrderTable()
    {
        var created = new InitialAmarGram().UpOperations.OfType<CreateTableOperation>().Where(t => t.Schema == "subscription").ToList();
        var cycle = created.Single(t => t.Name == "subscription_cycle");

        Assert.Equal("numeric(5,2)", cycle.Columns.Single(c => c.Name == "discount_percent").ColumnType);
        Assert.DoesNotContain(cycle.Columns, c => c.Name is "total" or "amount" or "subtotal" or "unit_price");
        Assert.DoesNotContain(created, t => t.Name.Contains("order_line") || t.Name.Contains("reservation") || t.Name.Contains("invoice"));
    }
}
