using AmarGram.Application.Commands.Product;
using AmarGram.Application.DataMappers;
using AmarGram.Domain.Aggregates.Product;
using AmarGram.Domain.Aggregates.StoredFile;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Product;

/// <summary>HO-SHP-001 section 11.4 C8. HO-P4 BG-14: a NEW certificate file must be a fresh <c>OrganicCertificate</c> upload of the
/// caller's own and must not already belong to another product (same attach rule as <c>SetProductImagesCommandHandler</c>); a file
/// the product already carries is re-submitted unchanged without the attach-window check.</summary>
public sealed class SetFoodDetailsCommandHandler(
    ILogger<SetFoodDetailsCommandHandler> logger,
    IAggregateRootRepository<ProductAggregate> productRepository,
    IAggregateRootRepository<StoredFileAggregate> fileRepository,
    TimeProvider timeProvider)
    : ICommandHandlerAsync<SetFoodDetailsCommand>
{
    public async Task<CommandResponse> HandleAsync(SetFoodDetailsCommand command)
    {
        logger.LogInformation("Setting food details for product {ProductId}. CorrelationId: {CorrelationId}", command.ProductId, command.CorrelationId);

        var product = await productRepository.GetByIdAsync(command.ProductId);
        if (product is null)
            return Violation(BusinessViolationCodes.ProductNotFound, nameof(command.ProductId), $"Product '{command.ProductId}' was not found.");

        if (product.Version != command.ExpectedVersion)
            return Violation(BusinessViolationCodes.ProductVersionConflict, nameof(command.ExpectedVersion), $"Expected version {command.ExpectedVersion} but the product is at {product.Version}.");

        if (command.OrganicCertificateFileId is { } fileId && fileId != product.FoodDetails?.OrganicCertificateFileId)
        {
            var file = await fileRepository.GetByIdAsync(fileId);
            var inUse = await productRepository.ExistAsync(p => p.Id != product.Id && p.FoodDetails != null && p.FoodDetails.OrganicCertificateFileId == fileId);
            if (file is null || inUse || !file.IsEligibleForAttach(FilePurpose.OrganicCertificate, command.UserContext.UserId, timeProvider.GetUtcNow(), FileRules.AttachWindow))
                return Violation(BusinessViolationCodes.InvalidCertificateFile, nameof(command.OrganicCertificateFileId), "The uploaded certificate could not be attached. Upload it again and save immediately.");
        }

        try
        {
            product.SetFoodDetails(command.ToDomainDto(), command.UserContext, command.CorrelationId);
        }
        catch (DomainRuleViolationException ex)
        {
            return Violation(ex.ErrorCode, ex.PropertyName, ex.Message);
        }

        await productRepository.UpdateAsync(product, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true };
    }

    private static CommandResponse Violation(string code, string property, string message)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: nameof(ProductAggregate));
        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }
}
