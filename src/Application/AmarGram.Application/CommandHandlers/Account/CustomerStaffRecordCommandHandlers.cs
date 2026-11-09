using AmarGram.Application.Commands.Account;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Account;

/// <summary>
/// HO-P4 BG-19. Add a staff note to a customer. The customer must exist and be active (an erased, merged or otherwise dead record takes no new
/// personal data); the staff record is created on its first write (shared key = customer id, a first-write race is a 409 through the
/// unique-constraint filter). The note text is never logged.
/// </summary>
public sealed class AddCustomerNoteCommandHandler(
    ILogger<AddCustomerNoteCommandHandler> logger,
    IAggregateRootRepository<CustomerAccountAggregate> customerRepository,
    IAggregateRootRepository<CustomerStaffRecordAggregate> recordRepository,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<AddCustomerNoteCommand>
{
    public async Task<CommandResponse> HandleAsync(AddCustomerNoteCommand command)
    {
        logger.LogInformation("Adding a staff note to customer {CustomerId}. CorrelationId: {CorrelationId}", command.CustomerId, command.CorrelationId);

        var refusal = await CustomerStaffRecordSupport.EnsureActiveCustomerAsync(customerRepository, command.CustomerId);
        if (refusal is not null) return refusal;

        var record = await recordRepository.GetByIdAsync(command.CustomerId);
        var isNew = record is null;
        if (record is null)
        {
            record = new CustomerStaffRecordAggregate(command.CustomerId);
            record.Open(new CustomerStaffRecordOpenDto(command.UserContext!, command.CorrelationId));
        }

        try
        {
            record.AddNote(new CustomerNoteAddDto(
                command.NoteId, command.UserContext!.UserId, command.Text, timeProvider.GetUtcNow(), command.UserContext!, command.CorrelationId));
        }
        catch (DomainRuleViolationException ex)
        {
            return CustomerStaffRecordSupport.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        if (isNew) await recordRepository.SaveAsync(record, EventPublishOption.InMemoryPublishOnly);
        else await recordRepository.UpdateAsync(record, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = new { noteId = command.NoteId } };
    }
}

/// <summary>HO-P4 BG-19. Replace a customer's tags (same customer and first-write rules as a note).</summary>
public sealed class SetCustomerTagsCommandHandler(
    ILogger<SetCustomerTagsCommandHandler> logger,
    IAggregateRootRepository<CustomerAccountAggregate> customerRepository,
    IAggregateRootRepository<CustomerStaffRecordAggregate> recordRepository)
    : ICommandHandlerAsync<SetCustomerTagsCommand>
{
    public async Task<CommandResponse> HandleAsync(SetCustomerTagsCommand command)
    {
        logger.LogInformation("Setting tags on customer {CustomerId}. CorrelationId: {CorrelationId}", command.CustomerId, command.CorrelationId);

        var refusal = await CustomerStaffRecordSupport.EnsureActiveCustomerAsync(customerRepository, command.CustomerId);
        if (refusal is not null) return refusal;

        var record = await recordRepository.GetByIdAsync(command.CustomerId);
        var isNew = record is null;
        if (record is null)
        {
            record = new CustomerStaffRecordAggregate(command.CustomerId);
            record.Open(new CustomerStaffRecordOpenDto(command.UserContext!, command.CorrelationId));
        }

        try
        {
            record.SetTags(new CustomerTagsSetDto(command.Tags, command.UserContext!, command.CorrelationId));
        }
        catch (DomainRuleViolationException ex)
        {
            return CustomerStaffRecordSupport.Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        if (isNew) await recordRepository.SaveAsync(record, EventPublishOption.InMemoryPublishOnly);
        else await recordRepository.UpdateAsync(record, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = new { tags = record.Labels } };
    }
}

internal static class CustomerStaffRecordSupport
{
    public static async Task<CommandResponse?> EnsureActiveCustomerAsync(IAggregateRootRepository<CustomerAccountAggregate> customerRepository, Guid customerId)
    {
        var customer = await customerRepository.GetByIdAsync(customerId);
        if (customer is null)
            return Violation(BusinessViolationCodes.CustomerNotFound, "CustomerId", "This customer record was not found.");

        return customer.Status == CustomerAccountStatus.Active
            ? null
            : Violation(BusinessViolationCodes.AccountNotActive, "CustomerId", "This account is not active.");
    }

    public static CommandResponse Violation(string code, string property, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: nameof(CustomerStaffRecordAggregate));
        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }
}
