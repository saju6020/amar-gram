using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record PasswordResetTokenIssueDto(
    AccountKind AccountKind,
    Guid AccountId,
    string TokenHash,
    Guid IssuedForSecurityStamp,
    DateTimeOffset IssuedOn,
    DateTimeOffset ExpiresOn,
    PasswordResetChannel Channel,
    UserContext UserContext,
    Guid CorrelationId,
    Guid? InitiatedByStaffId = null); // HO-P4 BG-19: set when a staff member started the reset for the account holder
