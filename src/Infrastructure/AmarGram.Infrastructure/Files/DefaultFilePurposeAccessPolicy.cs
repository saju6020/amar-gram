using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Infrastructure.Files;

/// <summary>The production <see cref="IFilePurposeAccessPolicy"/> -- wraps the static
/// <see cref="FilePurposeAccess"/> registry. A test host overrides the DI registration with its
/// own decorator instead of editing this type (gate-fix 2026-09-27, SECURITY MEDIUM).</summary>
public sealed class DefaultFilePurposeAccessPolicy : IFilePurposeAccessPolicy
{
    public bool TryGetRequiredStaffAction(FilePurpose purpose, out string action) =>
        FilePurposeAccess.TryGetRequiredStaffAction(purpose, out action);

    public bool IsAllowedForCustomer(FilePurpose purpose) => FilePurposeAccess.IsAllowedForCustomer(purpose);
}
