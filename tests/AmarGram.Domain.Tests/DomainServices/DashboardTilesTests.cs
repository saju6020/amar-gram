using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using Xunit;

namespace AmarGram.Domain.Tests.DomainServices;

/// <summary>HO-RPT-001 section 15 E -- U-E1 and U-E3: the tile set per role. Pure.</summary>
public sealed class DashboardTilesTests
{
    private static string[] Keys(params string[] roles) => DashboardTiles.ForRoles(roles).Select(t => t.Key).ToArray();

    [Fact]
    public void U_E1_EveryRole_GetsTheTilesOfSection811()
    {
        Assert.Empty(Keys(StaffRoles.Reception));
        Assert.Equal(["stock.expiry", "stock.low", "stock.consignments-open"], Keys(StaffRoles.Inventory));
        Assert.Equal(["orders.today", "orders.awaiting-transfer", "orders.returns-pending", "revenue.shop-today"], Keys(StaffRoles.ShopManager));
        Assert.Equal(["orders.awaiting-transfer", "payments.today", "payments.unreconciled", "billing.cash-up", "billing.receivables"], Keys(StaffRoles.Accountant));
        Assert.Equal(["stock.expiry", "orders.today", "payments.today", "billing.receivables", "revenue.today-by-line"], Keys(StaffRoles.Administrator));
    }

    [Fact]
    public void U_E1_ForAShopManagerWhoIsAlsoAnAccountant_TheUnionIsDeduplicated_InTheOrderOfTheFirstRoleInStaffRolesOrder()
    {
        var keys = Keys(StaffRoles.Accountant, StaffRoles.ShopManager); // the roles are ordered by StaffRoles.All, so ShopManager comes first whatever the order given

        Assert.Equal(keys.Distinct().Count(), keys.Length);
        Assert.Equal("orders.today", keys[0]);
        Assert.Contains("payments.today", keys);
        Assert.Contains("revenue.shop-today", keys);
        Assert.Single(keys, k => k == "orders.awaiting-transfer");
        Assert.True(Array.IndexOf(keys, "revenue.shop-today") < Array.IndexOf(keys, "payments.today"));
    }

    [Fact]
    public void U_E3_Reception_GetsNoTile_AndHoldsNoReportAction()
    {
        Assert.Empty(DashboardTiles.ForRole(StaffRoles.Reception));
        Assert.False(ReportAccessPolicy.Holds([StaffRoles.Reception], Actions.Reports.Any));
    }

    [Fact]
    public void U_E4_OnlyBuiltModulesHaveTiles_AndEveryTileNamesAGateAction()
    {
        Assert.All(DashboardTiles.All, t => Assert.Matches("^(stock|orders|revenue|payments|billing)\\.", t.Key));
        Assert.Equal(12, DashboardTiles.All.Count);
        Assert.All(DashboardTiles.All, t => Assert.True(ActionRoles.TryGetRoles(t.GateAction, out _), t.Key));
        Assert.Equal(DashboardTiles.All.Count, DashboardTiles.All.Select(t => t.Key).Distinct().Count());
    }
}
