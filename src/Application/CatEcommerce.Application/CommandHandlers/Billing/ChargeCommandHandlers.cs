using CatEcommerce.Application.Commands.Billing;
using CatEcommerce.Application.DataMappers;
using CatEcommerce.Domain.Aggregates.Account;
using CatEcommerce.Domain.Aggregates.Billing;
using CatEcommerce.Domain.DomainServices;
using CatEcommerce.Domain.Exceptions;
using CatEcommerce.Domain.Models;
using CatEcommerce.Domain.ValueObjects;
using CatEcommerce.Shared.Common.Constants;
using CatEcommerce.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using static CatEcommerce.Application.CommandHandlers.Billing.BillingHandlerSupport;

namespace CatEcommerce.Application.CommandHandlers.Billing;

/// <summary>HO-BIL-001 §11.4 C2 -- a desk charge. The customer must exist and be active; the tax class must exist (its <i>rate</i> is resolved at
/// issue, not here -- ADR-181).</summary>
public sealed class RecordManualChargeCommandHandler(
    IAggregateRootRepository<CustomerAccountAggregate> customerRepository,
    IAggregateRootRepository<ChargeAggregate> chargeRepository,
    IBillingPricingInputs pricingInputs,
    IBusinessSettings businessSettings,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<RecordManualChargeCommand>
{
    public async Task<CommandResponse> HandleAsync(RecordManualChargeCommand command)
    {
        var customer = await customerRepository.GetByIdAsync(command.CustomerId);
        if (customer is null || customer.Status != CustomerAccountStatus.Active)
            return Violation(BusinessViolationCodes.CustomerNotFound, nameof(command.CustomerId), "Customer not found.");

        var now = timeProvider.GetUtcNow();
        var currency = businessSettings.GetString(SettingKeys.CommerceCurrencyCode);

        var description = command.Description!;
        var unitPrice = command.UnitPrice!.Value;
        var taxClassId = command.TaxClassId!.Value;
        var itemKind = ItemKind.Fee;

        var rates = await pricingInputs.GetTaxRatesAsync([taxClassId], now);
        if (!rates.ContainsKey(taxClassId))
            return Violation(BusinessViolationCodes.TaxClassNotFound, nameof(command.TaxClassId), "Tax class not found.");

        var businessLine = string.IsNullOrWhiteSpace(command.BusinessLine) ? BusinessLine.Shop : BillingMapper.ParseEnum<BusinessLine>(command.BusinessLine);

        var request = new ChargeRequestDto(
            command.CustomerId, command.BranchId, businessLine, itemKind, ChargeSourceKind.Manual, command.ChargeId,
            ChargeRules.DefaultSourceLineRef, description, command.Quantity,
            new Money(unitPrice, currency), new Money(command.LineDiscount, currency), taxClassId, command.ServiceDate);

        var charge = new ChargeAggregate(command.ChargeId);
        try
        {
            charge.Record(request, new ChargeRecordContext(businessSettings.GetString(SettingKeys.CommerceCurrencyCode), now, command.ToBillingActor()));
        }
        catch (DomainRuleViolationException ex)
        {
            return Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        await chargeRepository.SaveAsync(charge, EventPublishOption.InMemoryPublishOnly);
        return Success(charge.Id);
    }
}

/// <summary>HO-BIL-001 §11.4 C3 -- void an unbilled charge. A charge of another branch is "not found" (HO-ADM-001
/// §8.2); one already on an invoice is refused (corrected by credit note instead).</summary>
public sealed class VoidChargeCommandHandler(
    IBillingFinder finder,
    IAggregateRootRepository<ChargeAggregate> chargeRepository,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<VoidChargeCommand>
{
    public async Task<CommandResponse> HandleAsync(VoidChargeCommand command)
    {
        var charge = await chargeRepository.GetByIdAsync(command.ChargeId);
        if (charge is null || charge.BranchId != command.BranchId)
            return Violation(BusinessViolationCodes.ChargeNotFound, nameof(command.ChargeId), "Charge not found.");

        if ((await finder.GetBilledChargeIdsAsync([charge.Id])).Contains(charge.Id))
            return Violation(BusinessViolationCodes.ChargeAlreadyInvoiced, nameof(command.ChargeId), BillingMessages.ChargeAlreadyInvoiced);


        try
        {
            charge.Void(command.Reason, timeProvider.GetUtcNow(), command.ToBillingActor());
        }
        catch (DomainRuleViolationException ex)
        {
            return Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        await chargeRepository.UpdateAsync(charge, EventPublishOption.InMemoryPublishOnly);
        return Success();
    }
}
