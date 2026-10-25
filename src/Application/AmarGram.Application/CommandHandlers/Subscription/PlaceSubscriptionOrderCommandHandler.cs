using AmarGram.Application.CommandHandlers.Order;
using AmarGram.Application.Commands.Order;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using static AmarGram.Application.CommandHandlers.Subscription.SubscriptionResults;

namespace AmarGram.Application.CommandHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §8.12 (C-ORD-1, adapted), ADR-241, ADR-242 -- place one subscription cycle's order as the <b>system actor</b>, through Ordering's own machinery:
/// the same ports, the same pure <c>CheckoutPricing</c>, the same FEFO reservation, the same billing and messages as a customer's checkout
/// (<see cref="PlaceOrderCommandHandler"/>), but with the cycle's lines instead of a cart, no quote-fingerprint acknowledgement (a system-placed order has
/// nobody to acknowledge a price change -- the pre-charge notice carried the estimate), the <c>Subscription</c> channel and the subscriber discount as a labelled
/// line discount. <b>Exactly once</b>: the order is placed under <c>SubscriptionKeys.OrderIdempotencyGuid(subscription, cycle)</c> -- an order already holding
/// that key for this customer is returned as the result and nothing is placed again. Dispatched by the worker in its own scope; never from another handler.
/// </summary>
public sealed class PlaceSubscriptionOrderCommandHandler(
    IAggregateRootRepository<OrderAggregate> orders,
    IAggregateRootRepository<BranchAggregate> branches,
    IAggregateRootRepository<BankTransferAccountAggregate> bankAccounts,
    ICheckoutInputsLoader inputsLoader,
    ICustomerDirectory customers,
    IOrderNumberGenerator numbers,
    IStockLedger stock,
    IBillableChargeRecorder charges,
    IOrderBillingReader billingReader,
    ITransactionalScope transaction,
    IInMemoryDispatcher dispatcher,
    INotificationOutbox outbox,
    INotificationLinkBuilder links,
    IBusinessSettings settings,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<PlaceSubscriptionOrderCommand>
{
    public async Task<CommandResponse> HandleAsync(PlaceSubscriptionOrderCommand command)
    {
        var key = SubscriptionKeys.OrderIdempotencyGuid(command.SubscriptionId, command.CycleOn);

        // Exactly once: a retried or crashed cycle finds its order rather than placing a second one.
        var existing = await orders.GetByFilterAsync(o => o.CustomerId == command.CustomerId && o.IdempotencyKey == key);
        if (existing is not null) return Success(OrderPlacement.ResultFor(existing, null));

        var now = timeProvider.GetUtcNow();
        var customer = await customers.GetCustomerAsync(command.CustomerId, default);
        if (customer is not { IsActive: true }) return Violation(BusinessViolationCodes.SubscriptionNotFound, nameof(command.CustomerId), "The customer is not active.");

        var (inputs, quote) = await SubscriptionCheckout.QuoteAsync(
            inputsLoader, command.CustomerId, command.SkuId, command.Quantity, command.Fulfilment, command.DeliveryAddressId, command.PickupBranchId,
            command.PaymentMethod, command.DiscountPercent, now, default);

        // A subscription never ships a reduced or partial order: a sold-out or withdrawn product fails the cycle with the reason Orders would give.
        if (inputs.Lines.Count == 0) return Violation(BusinessViolationCodes.SkuNotPurchasable, nameof(command.SkuId), OrderMessages.SkuNotPurchasable);

        if (quote.ExcludedLines.FirstOrDefault() is { } excluded)
        {
            if (excluded.ReasonCode == "TaxRateNotConfigured") return Violation("TaxRateNotConfigured", nameof(command.SkuId), "This product cannot be priced right now.");

            return inputs.Lines[0].Sku.IsPurchasable
                ? Violation(BusinessViolationCodes.SkuUnavailable, nameof(command.SkuId), OrderMessages.SkuUnavailable)
                : Violation(BusinessViolationCodes.SkuNotPurchasable, nameof(command.SkuId), OrderMessages.SkuNotPurchasable);
        }

        if (quote.Lines.Sum(l => l.Quantity) < command.Quantity)
            return Violation(BusinessViolationCodes.StockNoLongerAvailable, nameof(command.Quantity), OrderMessages.StockNoLongerAvailable);

        if (!quote.CanPlace) return OrderPlacement.RefusalFor(quote);

        var recipientPhone = customer.Mobile;
        if (command.Fulfilment == SubscriptionFulfilment.Delivery && string.IsNullOrWhiteSpace(recipientPhone))
            return Violation(BusinessViolationCodes.RecipientPhoneRequired, "RecipientPhone", OrderMessages.RecipientPhoneRequired);

        var branch = await branches.GetByIdAsync(quote.FulfilmentBranchId);
        if (branch is null) return Violation(BusinessViolationCodes.PickupBranchUnavailable, nameof(command.PickupBranchId), "That branch is not available.");

        try
        {
            return await transaction.RunAsync(() => PlaceAsync(command, key, now, inputs, quote, customer.FullName, recipientPhone, branch), response => response.IsSuccess);
        }
        catch (DomainRuleViolationException ex)
        {
            return FromRule(ex); // the stock race at commit surfaces as StockNoLongerAvailable and rolled the whole unit back
        }
    }

    private async Task<CommandResponse> PlaceAsync(
        PlaceSubscriptionOrderCommand command, Guid key, DateTimeOffset now, CheckoutInputs inputs, CheckoutQuote quote, string recipientName, string? recipientPhone, BranchAggregate branch)
    {
        var discountLabel = quote.Discount is { Applied: true } ? quote.Discount.Code : null;

        var order = new OrderAggregate(command.OrderId);
        order.Place(new PlaceOrderDto(
            await numbers.NextAsync(now), OrderChannel.Subscription, command.CustomerId, quote.FulfilmentBranchId, inputs.Choice.Method, command.PaymentMethod.ToOrderPaymentMethod(),
            quote.CurrencyCode, OrderPlacement.FulfilmentFor(inputs, quote, recipientName, recipientPhone), quote.Lines.ToDomainDtos(), quote.Totals.ToOrderTotals(),
            null, discountLabel is null ? null : SubscriptionMessages.DiscountLabel, quote.Fingerprint, key, now, command.UserContext!, command.CorrelationId, quote.DeliveryTaxOf()));

        // ── stock: Inventory chooses the batches (FEFO); Ordering records them ──
        var reserved = await OrderStock.ReserveAsync(stock, transaction, order);
        if (!reserved.IsSuccess) return Violation(reserved.ViolationCode!, reserved.PropertyName!, reserved.Message!);
        order.RecordAllocations(reserved.Allocations);

        // ── how the order is paid: COD and pay-on-collection are accepted at once; a bank transfer is held for its window ──
        BankTransferAccountAggregate? account = null;
        if (command.PaymentMethod == SubscriptionPaymentMethod.BankTransfer)
        {
            account = await bankAccounts.GetByIdAsync(BankTransferAccountAggregate.SingletonId);
            if (account is not { IsActive: true })
                return Violation(BusinessViolationCodes.PaymentMethodUnavailable, nameof(command.PaymentMethod), OrderMessages.PaymentMethodUnavailable);

            order.AwaitTransfer(now.AddHours(settings.GetInt(SettingKeys.OrdersBankTransferWindowHours)));
            OrderNotifications.EnqueueAwaitingTransfer(outbox, links, order, account, branch.TimeZoneId, command.CorrelationId, command.UserContext!);
        }
        else
        {
            var serviceDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(branch.TimeZoneId)).DateTime);
            var deliveryTaxClass = order.Totals.DeliveryCharge > 0m ? (await billingReader.GetDeliveryTaxAsync(now, default)).TaxClassId : null;
            await OrderBilling.RecordChargesAsync(charges, OrderBilling.BuildCharges(order, deliveryTaxClass, serviceDate));
            OrderNotifications.EnqueueConfirmed(outbox, links, order, paid: false, command.CorrelationId, command.UserContext!);
        }

        // One save: the order, its reservation, the charges and the messages.
        await orders.SaveAsync(order, EventPublishOption.InMemoryPublishOnly);

        if (command.PaymentMethod != SubscriptionPaymentMethod.BankTransfer)
        {
            var invoice = await OrderBilling.IssueInvoiceAsync(dispatcher, order, command);
            order.AttachInvoice(invoice.InvoiceId, invoice.Number);
            await orders.UpdateAsync(order, EventPublishOption.InMemoryPublishOnly);
        }

        return Success(OrderPlacement.ResultFor(order, account));
    }
}
