using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Xunit;

namespace AmarGram.Domain.Tests.Aggregates.Administration;

/// <summary>HO-P4 BG-21 (branch type) and BG-22 (derived staff-account status).</summary>
public sealed class BranchTypeAndStaffStatusTests
{
    private static BranchAggregate Created(BranchType? type = null)
    {
        var branch = new BranchAggregate(Guid.NewGuid());
        branch.Create(new BranchCreateDto("MAIN", "Main", "Asia/Dhaka", null, null, null, TestUserContext.Create(), Guid.NewGuid(), type));
        return branch;
    }

    [Fact]
    public void ABranchCreatedWithoutAType_IsAnOutlet()
    {
        Assert.Equal(BranchType.Outlet, Created().Type);
        Assert.Equal(BranchType.Outlet, new BranchAggregate(Guid.NewGuid()).Type);
    }

    [Fact]
    public void ABranchCanBeCreatedAsAWarehouse()
    {
        Assert.Equal(BranchType.Warehouse, Created(BranchType.Warehouse).Type);
    }

    [Fact]
    public void UpdatingDetails_WithoutAType_KeepsIt_AndWithOne_ChangesIt()
    {
        var branch = Created(BranchType.Warehouse);

        branch.UpdateDetails(new BranchDetailsUpdateDto("Main", "Asia/Dhaka", "1 Road", null, null, TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal(BranchType.Warehouse, branch.Type);

        branch.UpdateDetails(new BranchDetailsUpdateDto("Main", "Asia/Dhaka", "1 Road", null, null, TestUserContext.Create(), Guid.NewGuid(), BranchType.Outlet));
        Assert.Equal(BranchType.Outlet, branch.Type);
    }

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void NoPassword_IsNotSetUp_EvenIfAThrottleIsRunning()
    {
        Assert.Equal(StaffAccountStatus.NotSetUp, StaffAccountStatusRules.Derive(false, null, Now));
        Assert.Equal(StaffAccountStatus.NotSetUp, StaffAccountStatusRules.Derive(false, Now.AddMinutes(5), Now));
    }

    [Fact]
    public void APasswordAndARunningLockout_IsLocked_ButAnExpiredOneIsActive()
    {
        Assert.Equal(StaffAccountStatus.Locked, StaffAccountStatusRules.Derive(true, Now.AddSeconds(1), Now));
        Assert.Equal(StaffAccountStatus.Active, StaffAccountStatusRules.Derive(true, Now, Now));
        Assert.Equal(StaffAccountStatus.Active, StaffAccountStatusRules.Derive(true, Now.AddSeconds(-1), Now));
        Assert.Equal(StaffAccountStatus.Active, StaffAccountStatusRules.Derive(true, null, Now));
    }
}
