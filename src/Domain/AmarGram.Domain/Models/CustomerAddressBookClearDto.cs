using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>Anonymisation only (§8.10a).</summary>
public sealed record CustomerAddressBookClearDto(UserContext UserContext, Guid CorrelationId);
