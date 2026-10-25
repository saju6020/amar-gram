using AmarGram.Application.Commands.Product;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Product;

/// <summary>
/// HO-P4 BG-10. Orchestrates the existing single-product handlers over a list of products, so publish/hide keep exactly one rule set
/// (the checklist, the transition guard, the domain events). Per product: load it, take ITS CURRENT version, run the single-product
/// handler -- so no version travels in the request (see <see cref="BulkChangeProductStatusCommand"/>). A violation never aborts the batch:
/// it is recorded against that product and the next one is attempted. The response is a success carrying a
/// <see cref="BulkProductStatusResult"/>; the endpoint answers 200 whatever the mix of outcomes.
/// </summary>
public sealed class BulkChangeProductStatusCommandHandler(
    ILogger<BulkChangeProductStatusCommandHandler> logger,
    IAggregateRootRepository<ProductAggregate> productRepository,
    ICommandHandlerAsync<PublishProductCommand> publishHandler,
    ICommandHandlerAsync<UnpublishProductCommand> unpublishHandler)
    : ICommandHandlerAsync<BulkChangeProductStatusCommand>
{
    public async Task<CommandResponse> HandleAsync(BulkChangeProductStatusCommand command)
    {
        logger.LogInformation("Bulk {Action} of {Count} products. CorrelationId: {CorrelationId}", command.Action, command.ProductIds.Count, command.CorrelationId);

        if (!BulkProductActions.All.Contains(command.Action, StringComparer.Ordinal))
            return Failure(BusinessViolationCodes.InvalidBulkAction, nameof(command.Action), "Action must be Publish or Unpublish.");

        var publish = command.Action == BulkProductActions.Publish;
        var items = new List<BulkProductStatusItem>();

        foreach (var productId in command.ProductIds.Distinct())
        {
            var product = await productRepository.GetByIdAsync(productId);
            if (product is null)
            {
                items.Add(new BulkProductStatusItem(productId, false, null, BusinessViolationCodes.ProductNotFound, nameof(command.ProductIds), $"Product '{productId}' was not found."));
                continue;
            }

            var response = publish
                ? await publishHandler.HandleAsync(new PublishProductCommand
                {
                    ProductId = productId, ExpectedVersion = product.Version, UserContext = command.UserContext, CorrelationId = command.CorrelationId
                })
                : await unpublishHandler.HandleAsync(new UnpublishProductCommand
                {
                    ProductId = productId, ExpectedVersion = product.Version, UserContext = command.UserContext, CorrelationId = command.CorrelationId
                });

            if (response.IsSuccess)
            {
                items.Add(new BulkProductStatusItem(productId, true, (publish ? ProductStatus.Active : ProductStatus.Draft).DisplayName, null, null, null));
                continue;
            }

            var error = response.ValidationResult?.Errors?.FirstOrDefault();
            items.Add(new BulkProductStatusItem(productId, false, null, error?.ErrorCode, error?.PropertyName, error?.ErrorMessage));
        }

        var succeeded = items.Count(i => i.Succeeded);
        return new CommandResponse { IsSuccess = true, Result = new BulkProductStatusResult(command.Action, succeeded, items.Count - succeeded, items) };
    }

    private static CommandResponse Failure(string code, string property, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: nameof(ProductAggregate));
        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }
}
