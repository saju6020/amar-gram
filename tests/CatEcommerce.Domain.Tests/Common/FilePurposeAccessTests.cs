using CatEcommerce.Shared.Common.Constants;
using CatEcommerce.Shared.Common.Enums;

namespace CatEcommerce.Domain.Tests.Common;

/// <summary>
/// Gate-fix 2026-09-27 (SECURITY MEDIUM, HO-FIL-001-SECURITY.md first pass): the per-purpose gate
/// must fail CLOSED -- a purpose with no registered staff action is refused for every role, rather
/// than falling through to the baseline <c>Actions.Files.Upload</c> check (which every staff role
/// holds). No automated test proved this at the policy level before this TEST gate: every
/// <c>FilesApiFactory</c>-based integration test runs behind a test-only decorator
/// (<c>UnownedPurposeAllowingPolicy</c>) that deliberately widens unmapped purposes back open, by
/// design, so the real, fail-closed <see cref="FilePurposeAccess"/> was exercised only by the
/// SECURITY gate's own throwaway probe (never persisted).
/// </summary>
public sealed class FilePurposeAccessTests
{
    public static IEnumerable<object[]> EveryCanonicalPurpose()
    {
        yield return [FilePurpose.ProductImage];
        yield return [FilePurpose.ReportExport];
    }

    public static IEnumerable<object[]> PurposesWithNoRegisteredOwner()
    {
        yield return [FilePurpose.ReportExport];
    }

    [Theory]
    [MemberData(nameof(PurposesWithNoRegisteredOwner))]
    public void TryGetRequiredStaffAction_refuses_every_purpose_with_no_registered_owner(FilePurpose purpose)
    {
        var found = FilePurposeAccess.TryGetRequiredStaffAction(purpose, out var action);

        Assert.False(found);
        Assert.Equal("", action);
    }

    [Fact]
    public void TryGetRequiredStaffAction_maps_ProductImage_to_ShopProductsManage()
    {
        var found = FilePurposeAccess.TryGetRequiredStaffAction(FilePurpose.ProductImage, out var action);

        Assert.True(found);
        Assert.Equal(Actions.Shop.ProductsManage, action);
    }

    [Theory]
    [MemberData(nameof(EveryCanonicalPurpose))]
    public void IsAllowedForCustomer_refuses_every_purpose(FilePurpose purpose)
    {
        Assert.False(FilePurposeAccess.IsAllowedForCustomer(purpose));
    }
}
