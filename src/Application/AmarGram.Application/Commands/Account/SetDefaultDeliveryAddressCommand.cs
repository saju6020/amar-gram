using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class SetDefaultDeliveryAddressCommand : Command
{
    public required Guid AddressId { get; init; }
}
