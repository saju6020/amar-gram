using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.Tests.Common;

/// <summary>HO-ACC-001 §15, U-F5.</summary>
public sealed class StaffRoleCatalogueTests
{
    [Fact]
    public void Cells_Covers5RolesBy10Capabilities() =>
        Assert.Equal(5 * 10, StaffRoleCatalogue.Cells.Count);

    [Fact]
    public void Cells_NeverContainCustomerRole() =>
        Assert.DoesNotContain(StaffRoleCatalogue.Cells, c => c.RoleId == "Customer");

    [Fact]
    public void StaffRoles_All_HasFiveRolesInCatalogueOrder() =>
        Assert.Equal(
            new[] { "Reception", "Inventory", "ShopManager", "Accountant", "Administrator" },
            StaffRoles.All);
}
