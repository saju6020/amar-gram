using CatEcommerce.Domain.Events.Product;
using CatEcommerce.Domain.Exceptions;
using CatEcommerce.Domain.ValueObjects;
using CatEcommerce.Shared.Common.Constants;
using Platform.Infrastructure.Common.Security;

namespace CatEcommerce.Domain.Aggregates.Product;

/// <summary>HO-SHP-001 section 8.5 -- food-only fields: the owned <c>FoodDetails</c> value object.
/// Country of origin is set via <c>UpdateDetails</c>.</summary>
public sealed partial class ProductAggregate
{
    public void SetFoodDetails(FoodDetails details, UserContext userContext, Guid correlationId)
    {
        if (!IsFood)
            throw new DomainRuleViolationException(BusinessViolationCodes.FoodDetailsOnlyForFood, "Food details can only be set on a CatFood product.", nameof(Category));

        FoodDetails = details;
        RefreshSearchText();

        AddDomainEvent(new ProductFoodDetailsUpdatedEvent { ProductId = Id, CorrelationId = correlationId, UserContext = userContext });
        UpdateVersion();
    }
}
