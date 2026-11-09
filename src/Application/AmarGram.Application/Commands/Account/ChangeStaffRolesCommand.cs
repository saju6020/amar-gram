using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class ChangeStaffRolesCommand : Command
{
    public required Guid StaffAccountId { get; init; }
    public required IReadOnlyList<string> RoleIds { get; init; }
}
