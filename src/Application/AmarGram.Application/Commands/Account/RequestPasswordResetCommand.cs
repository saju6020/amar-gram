using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Account;

public sealed class RequestPasswordResetCommand : Command
{
    public required Guid TokenId { get; init; }
    public required AccountKind AccountKind { get; init; }
    public required string Identifier { get; init; }
}
