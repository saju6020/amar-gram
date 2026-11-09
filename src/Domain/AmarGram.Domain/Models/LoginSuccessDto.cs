using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record LoginSuccessDto(DateTimeOffset AsOf, UserContext UserContext, Guid CorrelationId);
