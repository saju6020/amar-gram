using AmarGram.Domain.ValueObjects;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-ACC-001 §8.3 (Register).</summary>
public sealed record CustomerRegistrationDto(
    string FullName,
    MobileNumber? MobileNumber,
    EmailAddress? EmailAddress,
    PasswordCredential Credential,
    UserContext UserContext,
    Guid CorrelationId);
