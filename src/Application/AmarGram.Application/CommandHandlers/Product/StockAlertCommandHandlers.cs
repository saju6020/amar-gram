using AmarGram.Application.Commands.Product;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Product;

/// <summary>
/// HO-SHP-001 section 11.4 C15. The SKU must be on sale (an Active SKU of an Active, listed product)
/// and its availability NOW must be <c>OutOfStock</c> (else <c>SkuAlreadyAvailable</c>); one Pending alert per
/// customer per SKU, pre-checked here and backed by the filtered unique index (section 12.5). The
/// controller dispatches <c>GetStockAlertDeliverabilityQuery</c> afterwards for the response.
/// </summary>
public sealed class RequestStockAlertCommandHandler(
    ILogger<RequestStockAlertCommandHandler> logger,
    IAggregateRootRepository<ProductAggregate> productRepository,
    IAggregateRootRepository<StockAlertAggregate> alertRepository,
    ISkuAvailabilityReader availabilityReader,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<RequestStockAlertCommand>
{
    public async Task<CommandResponse> HandleAsync(RequestStockAlertCommand command)
    {
        logger.LogInformation("Requesting a stock alert for SKU {SkuId}. CorrelationId: {CorrelationId}", command.SkuId, command.CorrelationId);

        var customerId = command.UserContext.UserId;

        var product = await productRepository.GetByFilterAsync(p => p.Skus.Any(s => s.Id == command.SkuId));
        if (product is null)
            return Violation(BusinessViolationCodes.SkuNotFound, nameof(command.SkuId), $"SKU '{command.SkuId}' was not found.");

        var sku = product.Skus.First(s => s.Id == command.SkuId);
        if (product.Status != ProductStatus.Active || !product.ListedOnStorefront || sku.Status != SkuStatus.Active)
            return Violation(BusinessViolationCodes.PurchaseNotPermitted, nameof(command.SkuId), "This item is not on sale.");

        var availability = await availabilityReader.GetAsync([command.SkuId]);
        if (availability.GetValueOrDefault(command.SkuId) == AvailabilityStatus.InStock)
            return Violation(BusinessViolationCodes.SkuAlreadyAvailable, nameof(command.SkuId), "This item is already available.");

        if (await alertRepository.ExistAsync(a => a.CustomerId == customerId && a.SkuId == command.SkuId && a.Status == StockAlertStatus.Pending))
            return Violation(BusinessViolationCodes.StockAlertAlreadyRequested, nameof(command.SkuId), ShopMessages.StockAlertAlreadyRequested);

        var alert = new StockAlertAggregate(command.StockAlertId);
        alert.Request(customerId, command.SkuId, timeProvider.GetUtcNow(), command.UserContext, command.CorrelationId);

        await alertRepository.SaveAsync(alert, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = alert.Id };
    }

    private static CommandResponse Violation(string code, string property, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: nameof(StockAlertAggregate));
        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }
}

/// <summary>HO-SHP-001 section 11.4 C15 -- the customer's own alert only (another customer's is
/// <c>StockAlertNotFound</c>, a 404). Cancelling an alert that is no longer Pending is a no-op
/// success: Notified is terminal history, and Closed is already closed.</summary>
public sealed class CancelStockAlertCommandHandler(
    ILogger<CancelStockAlertCommandHandler> logger,
    IAggregateRootRepository<StockAlertAggregate> alertRepository)
    : ICommandHandlerAsync<CancelStockAlertCommand>
{
    public async Task<CommandResponse> HandleAsync(CancelStockAlertCommand command)
    {
        logger.LogInformation("Cancelling stock alert {StockAlertId}. CorrelationId: {CorrelationId}", command.StockAlertId, command.CorrelationId);

        var alert = await alertRepository.GetByIdAsync(command.StockAlertId);
        if (alert is null || alert.CustomerId != command.UserContext.UserId)
        {
            var validationResponse = new ValidationResponse();
            validationResponse.AddError(errorMessage: $"Alert '{command.StockAlertId}' was not found.", propertyName: nameof(command.StockAlertId),
                errorCode: BusinessViolationCodes.StockAlertNotFound, resourceName: nameof(StockAlertAggregate));
            return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
        }

        if (alert.Status != StockAlertStatus.Pending) return new CommandResponse { IsSuccess = true };

        alert.Close(StockAlertClosureReason.CancelledByCustomer, command.UserContext, command.CorrelationId);
        await alertRepository.UpdateAsync(alert, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true };
    }
}

/// <summary>
/// HO-SHP-001 section 11.4 C16 -- dispatched per alert by <c>ShopWorker</c>. Re-checks that the
/// alert is still Pending and the SKU still sellable (else success with no write -- the next pass
/// retries); marks it Notified; <b>enqueues <c>shop.back-in-stock</c></b> through the outbox
/// BEFORE the save so the message is committed with the aggregate or not at all (HO-NTF-001
/// ADR-056/057). <c>Notified</c> is terminal: a later sell-out and restock sends nothing more
/// (US-SHP-13 AC1). The deduplication key makes a retried command idempotent at the outbox too.
/// </summary>
public sealed class NotifyStockAlertCommandHandler(
    ILogger<NotifyStockAlertCommandHandler> logger,
    IAggregateRootRepository<StockAlertAggregate> alertRepository,
    IAggregateRootRepository<ProductAggregate> productRepository,
    ISkuAvailabilityReader availabilityReader,
    INotificationOutbox outbox,
    INotificationLinkBuilder linkBuilder,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<NotifyStockAlertCommand>
{
    public async Task<CommandResponse> HandleAsync(NotifyStockAlertCommand command)
    {
        logger.LogInformation("Notifying stock alert {StockAlertId}. CorrelationId: {CorrelationId}", command.StockAlertId, command.CorrelationId);

        var alert = await alertRepository.GetByIdAsync(command.StockAlertId);
        if (alert is null || alert.Status != StockAlertStatus.Pending) return new CommandResponse { IsSuccess = true };

        var availability = await availabilityReader.GetAsync([alert.SkuId]);
        if (availability.GetValueOrDefault(alert.SkuId) != AvailabilityStatus.InStock) return new CommandResponse { IsSuccess = true };

        var product = await productRepository.GetByFilterAsync(p => p.Skus.Any(s => s.Id == alert.SkuId));
        if (product is null || product.Status != ProductStatus.Active || !product.ListedOnStorefront) return new CommandResponse { IsSuccess = true };

        var sku = product.Skus.First(s => s.Id == alert.SkuId);

        try
        {
            alert.MarkNotified(timeProvider.GetUtcNow(), command.UserContext, command.CorrelationId);
        }
        catch (DomainRuleViolationException)
        {
            return new CommandResponse { IsSuccess = true };
        }

        outbox.Enqueue(new NotificationRequestDto(
            Guid.NewGuid(), NotificationTemplateCatalogue.ShopBackInStock, NotificationRecipientKind.Customer, alert.CustomerId,
            new Dictionary<string, string>
            {
                ["productName"] = product.Name,
                // A single-variant product has no axes: "Chashi Rice (Chashi Rice)" would read oddly.
                ["variantLabel"] = sku.HasAnyAxis ? sku.Label(product.Name) : "Standard",
                ["productLink"] = linkBuilder.ProductLink(product.Slug, sku.Id)
            },
            SubjectKind: NotificationSubjectKind.StockAlert, SubjectId: alert.Id,
            DeduplicationKey: $"shop:back-in-stock:{alert.Id:N}",
            CorrelationId: command.CorrelationId, UserContext: command.UserContext));

        await alertRepository.UpdateAsync(alert, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true };
    }
}
