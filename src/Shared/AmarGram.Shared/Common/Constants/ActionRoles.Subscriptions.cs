namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-SUB-001 §12.3 (ADR-248) -- Subscriptions' rows in the solution-wide action-to-role table. Appendix D has no subscription row, so the mapping is
/// <b>inferred</b> from "Orders &amp; fulfilment" (Reception W, Inventory R, Shop Mgr F, Accountant R, Admin F).
/// Customer routes carry no row (customer-session reads and writes).
/// </summary>
public static partial class ActionRoles
{
    private static readonly (string Action, string[] Roles)[] SubscriptionsRows =
    [
        (Actions.Subscriptions.View, [StaffRoles.Reception, StaffRoles.Inventory, StaffRoles.ShopManager, StaffRoles.Accountant, StaffRoles.Administrator]),
        (Actions.Subscriptions.Manage, [StaffRoles.ShopManager, StaffRoles.Administrator]),
        (Actions.Subscriptions.Export, [StaffRoles.ShopManager, StaffRoles.Accountant, StaffRoles.Administrator]),
    ];
}
