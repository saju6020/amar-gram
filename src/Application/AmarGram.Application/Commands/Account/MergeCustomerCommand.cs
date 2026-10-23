using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class MergeCustomerCommand : Command
{
    public required Guid DuplicateCustomerId { get; init; }
    public required Guid SurvivingCustomerId { get; init; }
    public required string Reason { get; init; }
}
