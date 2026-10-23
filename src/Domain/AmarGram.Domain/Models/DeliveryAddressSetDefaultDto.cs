using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record DeliveryAddressSetDefaultDto(Guid AddressId, UserContext UserContext, Guid CorrelationId);
