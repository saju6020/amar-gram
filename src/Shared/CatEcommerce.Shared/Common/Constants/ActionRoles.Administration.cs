namespace CatEcommerce.Shared.Common.Constants;

/// <summary>
/// Administration and Configuration's own rows in the solution-wide action-to-role table
/// (HO-ADM-001 §12.3, ADR-043). Picked up automatically by <see cref="ActionRoles.BuildTable"/>.
/// </summary>
public static partial class ActionRoles
{
    private static readonly (string Action, string[] Roles)[] AdministrationRows =
    [
        (Actions.Branches.View, StaffRoles.All.ToArray()),
        (Actions.Branches.Manage, [StaffRoles.Administrator]),
        (Actions.Branches.ViewOwn, StaffRoles.All.ToArray()),

        (Actions.Rosters.View, [StaffRoles.Reception, StaffRoles.Administrator]),
        (Actions.Rosters.Manage, [StaffRoles.Administrator]),

        (Actions.Leave.Request, StaffRoles.All.ToArray()),
        (Actions.Leave.Decide, [StaffRoles.Administrator]),

        (Actions.TaxClasses.View, [StaffRoles.Administrator, StaffRoles.Accountant, StaffRoles.ShopManager]),
        (Actions.TaxClasses.Manage, [StaffRoles.Administrator]),

        (Actions.Settings.View, [StaffRoles.Administrator]),
        (Actions.Settings.Manage, [StaffRoles.Administrator]),

        (Actions.AuditLog.View, [StaffRoles.Administrator, StaffRoles.Accountant]),
        (Actions.AuditLog.Export, [StaffRoles.Administrator, StaffRoles.Accountant]),

        (Actions.Content.Manage, [StaffRoles.Administrator, StaffRoles.ShopManager]),
        (Actions.Policies.Manage, [StaffRoles.Administrator]),

        (Actions.SystemStatus.ManageMaintenance, [StaffRoles.Administrator]),
    ];
}
