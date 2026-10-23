using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class RemoveDeliveryAddressCommand : Command
{
    public required Guid AddressId { get; init; }
}
