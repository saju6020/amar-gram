using AmarGram.Application.Commands.Account;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Account;

/// <summary>
/// HO-P4 BG-19. Staff-initiated password reset for a customer -- the self-service reset (<see cref="RequestPasswordResetCommandHandler"/>), started
/// by a named customer instead of a typed identifier. Same pieces, so the customer finishes it exactly as they would their own request: a
/// <see cref="PasswordResetTokenAggregate"/> bound to the account's security stamp, the same expiry, a notification through
/// <see cref="IPasswordResetTokenDispatcher"/> (outbox, same transaction as the token), and the same confirm step.
///
/// Unlike the public request there is no neutral response: the caller is an authenticated staff member, so a refusal is a real answer
/// (<c>CustomerNotFound</c>, <c>AccountNotActive</c>, <c>NoResetChannel</c>). The channel is the customer's own: mobile if they have one,
/// otherwise email. The token is only ever sent to that channel, never returned. The audit entry names the staff member
/// (<c>PasswordResetRequestedByStaff</c>).
/// </summary>
public sealed class RequestCustomerPasswordResetCommandHandler(
    ILogger<RequestCustomerPasswordResetCommandHandler> logger,
    IAggregateRootRepository<CustomerAccountAggregate> customerRepository,
    IAggregateRootRepository<PasswordResetTokenAggregate> tokenRepository,
    IPasswordResetTokenGenerator tokenGenerator,
    IPasswordResetTokenDispatcher dispatcher,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<RequestCustomerPasswordResetCommand>
{
    public async Task<CommandResponse> HandleAsync(RequestCustomerPasswordResetCommand command)
    {
        logger.LogInformation("Staff-initiated password reset for customer {CustomerId}. CorrelationId: {CorrelationId}", command.CustomerId, command.CorrelationId);

        var refusal = await CustomerStaffRecordSupport.EnsureActiveCustomerAsync(customerRepository, command.CustomerId);
        if (refusal is not null) return refusal;

        var account = (await customerRepository.GetByIdAsync(command.CustomerId))!;

        var channel = account.MobileNumber is not null ? PasswordResetChannel.Mobile
            : account.EmailAddress is not null ? PasswordResetChannel.Email
            : null;
        if (channel is null)
            return CustomerStaffRecordSupport.Violation(BusinessViolationCodes.NoResetChannel, "CustomerId", "This customer has no mobile number or email address to send a reset to.");

        var asOf = timeProvider.GetUtcNow();
        var material = tokenGenerator.Generate(asOf);
        var masked = channel == PasswordResetChannel.Mobile
            ? IdentifierMasking.Mask(account.MobileNumber!.Value)
            : IdentifierMasking.Mask(account.EmailAddress!.Value);

        var token = new PasswordResetTokenAggregate(command.TokenId);
        token.Issue(new PasswordResetTokenIssueDto(
            AccountKind.Customer, account.Id, material.TokenHash, account.SecurityStamp,
            asOf, material.ExpiresOn, channel, command.UserContext!, command.CorrelationId, InitiatedByStaffId: command.UserContext!.UserId));

        // Dispatch BEFORE the token's own save: the dispatcher only enqueues an outbox request (no save), so it and the token commit together.
        await dispatcher.DispatchAsync(new PasswordResetDispatchRequest(
            AccountKind.Customer, account.Id, channel, masked, material.Token, material.ExpiresOn));

        await tokenRepository.SaveAsync(token, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse
        {
            IsSuccess = true,
            Result = new { channel = channel.DisplayName, maskedDestination = masked, expiresOn = material.ExpiresOn }
        };
    }
}
