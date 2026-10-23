using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record DeliveryAddressRemoveDto(Guid AddressId, UserContext UserContext, Guid CorrelationId);
