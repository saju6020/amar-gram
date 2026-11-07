using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Domain.Tests.Aggregates;

/// <summary>HO-ACC-001 §15 -- Staff & authorization (F).</summary>
public sealed class StaffAccountAggregateTests
{
    private static StaffAccountAggregate Create(params string[] roles)
    {
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto(
            "Staff Person", MobileNumber.Create("01712345678"), null, roles, TestUserContext.Create(), Guid.NewGuid()));
        return staff;
    }

    // U-F1
    [Fact]
    public void Create_NormalisesTrimsDeduplicatesAndOrdersRoles()
    {
        var staff = Create(" Inventory", "Inventory", "Reception");
        Assert.Equal(new[] { "Reception", "Inventory" }, staff.RoleIds);
    }

    // U-F2
    [Fact]
    public void Create_EmptyRoles_Throws()
    {
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        var ex = Assert.Throws<DomainRuleViolationException>(() => staff.Create(new StaffAccountCreationDto(
            "Name", MobileNumber.Create("01712345678"), null, [], TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal("StaffRolesRequired", ex.ErrorCode);
    }

    [Fact]
    public void Create_LowerCaseRole_Throws()
    {
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        var ex = Assert.Throws<DomainRuleViolationException>(() => staff.Create(new StaffAccountCreationDto(
            "Name", MobileNumber.Create("01712345678"), null, ["reception"], TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal("UnknownStaffRole", ex.ErrorCode);
    }

    [Fact]
    public void Create_UnknownRole_Throws()
    {
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        var ex = Assert.Throws<DomainRuleViolationException>(() => staff.Create(new StaffAccountCreationDto(
            "Name", MobileNumber.Create("01712345678"), null, ["Gardener"], TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal("UnknownStaffRole", ex.ErrorCode);
    }

    // U-F3
    [Fact]
    public void ChangeRoles_SameSet_NoEventNoVersionBumpStampUnchanged()
    {
        var staff = Create("Inventory", "Reception");
        staff.ClearEvents();
        var versionBefore = staff.Version;
        var stampBefore = staff.SecurityStamp;

        staff.ChangeRoles(new StaffRoleChangeDto(["Reception", "Inventory"], TestUserContext.Create(), Guid.NewGuid()));

        Assert.Empty(staff.Events);
        Assert.Equal(versionBefore, staff.Version);
        Assert.Equal(stampBefore, staff.SecurityStamp);
    }

    // U-F4
    [Fact]
    public void ChangeRoles_DifferentSet_RotatesStampAndRaisesEvent()
    {
        var staff = Create("Inventory");
        var stampBefore = staff.SecurityStamp;

        staff.ChangeRoles(new StaffRoleChangeDto(["Administrator"], TestUserContext.Create(), Guid.NewGuid()));

        Assert.NotEqual(stampBefore, staff.SecurityStamp);
        Assert.Equal(["Administrator"], staff.RoleIds);
    }

    [Fact]
    public void Create_PasswordCredentialIsNull() => Assert.Null(Create("Inventory").PasswordCredential);

    // U-G5-adjacent -- staff EnsureCanSignIn has no status check, only credential/lock.
    [Fact]
    public void EnsureCanSignIn_NoCredential_ReturnsInvalidCredentials()
    {
        var staff = Create("Inventory");
        var ex = Assert.Throws<DomainRuleViolationException>(() => staff.EnsureCanSignIn(DateTimeOffset.UtcNow));
        Assert.Equal(BusinessViolationCodes.InvalidCredentials, ex.ErrorCode);
    }
    // Owner, 2026-10-20: an administrator edits the name and sign-in identifiers.
    [Fact]
    public void UpdateDetails_Changed_RaisesEventWithBeforeAndAfter_StampUnchanged()
    {
        var staff = Create("Inventory");
        staff.ClearEvents();
        var stampBefore = staff.SecurityStamp;

        staff.UpdateDetails(new StaffAccountDetailsUpdateDto(
            "Staff Renamed", MobileNumber.Create("01712345678"), EmailAddress.Create("staff@example.test"), TestUserContext.Create(), Guid.NewGuid()));

        Assert.Equal("Staff Renamed", staff.FullName);
        Assert.Equal("staff@example.test", staff.EmailAddress?.Value);
        Assert.Equal(stampBefore, staff.SecurityStamp);
        var changed = Assert.IsType<AmarGram.Domain.Events.Account.StaffAccountDetailsChangedEvent>(Assert.Single(staff.Events));
        Assert.Equal("Staff Person", changed.PreviousFullName);
        Assert.Null(changed.PreviousEmailAddress);
        Assert.Equal("staff@example.test", changed.NewEmailAddress);
    }

    [Fact]
    public void UpdateDetails_NothingChanged_NoEventNoVersionBump()
    {
        var staff = Create("Inventory");
        staff.ClearEvents();
        var versionBefore = staff.Version;

        staff.UpdateDetails(new StaffAccountDetailsUpdateDto(
            "Staff Person", MobileNumber.Create("01712345678"), null, TestUserContext.Create(), Guid.NewGuid()));

        Assert.Empty(staff.Events);
        Assert.Equal(versionBefore, staff.Version);
    }

    [Fact]
    public void UpdateDetails_BlankNameOrNoIdentifier_Throws()
    {
        var staff = Create("Inventory");
        var blank = Assert.Throws<DomainRuleViolationException>(() => staff.UpdateDetails(new StaffAccountDetailsUpdateDto(
            " ", MobileNumber.Create("01712345678"), null, TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.NameRequired, blank.ErrorCode);

        var none = Assert.Throws<DomainRuleViolationException>(() => staff.UpdateDetails(new StaffAccountDetailsUpdateDto(
            "Staff Person", null, null, TestUserContext.Create(), Guid.NewGuid())));
        Assert.Equal(BusinessViolationCodes.IdentifierRequired, none.ErrorCode);
    }
}
