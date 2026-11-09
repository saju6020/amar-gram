using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record CustomerAddressBookOpenDto(UserContext UserContext, Guid CorrelationId);
