using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class SignOutCustomerCommand : Command
{
    public required string TokenHash { get; init; }
}
