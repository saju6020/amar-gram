using AmarGram.Domain.Events.Product;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Aggregates.Product;

/// <summary>HO-SHP-001 section 8.5, HO-P2 §1.3 -- food-only fields: the owned <c>FoodDetails</c> value object.
/// Country of origin is set via <c>UpdateDetails</c>.</summary>
public sealed partial class ProductAggregate
{
    public void SetFoodDetails(FoodDetails details, UserContext userContext, Guid correlationId)
    {
        if (!IsFood)
            throw new DomainRuleViolationException(BusinessViolationCodes.FoodDetailsOnlyForFood, "Food details can only be set on a food product.", nameof(Category));

        if (Status == ProductStatus.Active && RequiresOrganicCertificate && !details.HasOrganicCertificate)
            throw new DomainRuleViolationException(BusinessViolationCodes.OrganicCertificateRequired, "An active CertifiedOrganic product must keep its organic certifier and certificate number.", nameof(details.OrganicCertifier));

        FoodDetails = details;
        RefreshSearchText();

        AddDomainEvent(new ProductFoodDetailsUpdatedEvent { ProductId = Id, CorrelationId = correlationId, UserContext = userContext });
        UpdateVersion();
    }
}
