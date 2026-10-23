using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record LoginFailureDto(DateTimeOffset AsOf, UserContext UserContext, Guid CorrelationId);
