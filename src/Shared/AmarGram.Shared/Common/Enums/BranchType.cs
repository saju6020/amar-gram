namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-P4 BG-21. What a branch is: a customer-facing outlet, or a warehouse. Descriptive only -- no rule differs by type yet; every
/// existing branch, and every branch created without a type, is an <c>Outlet</c>.</summary>
public sealed class BranchType(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly BranchType Outlet = new(1, nameof(Outlet));
    public static readonly BranchType Warehouse = new(2, nameof(Warehouse));
}
