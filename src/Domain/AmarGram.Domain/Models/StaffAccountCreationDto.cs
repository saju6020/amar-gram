using AmarGram.Domain.ValueObjects;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record StaffAccountCreationDto(
    string FullName,
    MobileNumber? MobileNumber,
    EmailAddress? EmailAddress,
    IReadOnlyList<string> RoleIds,
    UserContext UserContext,
    Guid CorrelationId);
