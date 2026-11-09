using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class RecordStaffSessionActivityCommand : Command
{
    public required string TokenHash { get; init; }
    public string? IpAddress { get; init; }
}
