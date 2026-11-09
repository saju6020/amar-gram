using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-FIL-001 §9 OQ-7: "Who may call the upload endpoint for each purpose" -- "<c>ActionRoles</c>
/// per purpose, named by the consuming handover; the endpoint refuses a purpose the caller has no
/// action for."
///
/// Gate-fix 2026-09-27 (SECURITY MEDIUM, HO-FIL-001-SECURITY.md): fails CLOSED. A purpose with no
/// entry in <see cref="StaffPurposeActions"/> is refused for every staff role.
/// <c>[RequireAction(Actions.Files.Upload)]</c> still proves the caller is authenticated staff; this
/// registry is the *only* thing that decides which purposes that caller may actually use. A future
/// purpose that genuinely needs to stay open to every staff role still names that explicitly here
/// rather than relying on an absent entry to mean "allowed".
///
/// A test-only purpose is registered by the test host's own <c>IFilePurposeAccessPolicy</c> decorator
/// (<c>FilesApiFactory</c>), never here -- production code is not widened for a test fixture's
/// convenience.
///
/// Customers may upload no purpose at all (the HO-P1 retirement removed the only customer purpose).
/// </summary>
public static class FilePurposeAccess
{
    private static readonly IReadOnlyDictionary<FilePurpose, string> StaffPurposeActions =
        new Dictionary<FilePurpose, string>
        {
            // HO-SHP-001 (2026-10-04, found while writing U-A5b): the Shop catalogue consumes
            // ProductImage files (SetProductImagesCommandHandler) but no mapping existed, so the
            // fail-closed policy refused every staff role -- a product image could not be uploaded
            // in the real host. Same action that governs the product write that attaches it.
            [FilePurpose.ProductImage] = Actions.Shop.ProductsManage,
            // HO-P4 BG-14: the same product write attaches the organic certificate file.
            [FilePurpose.OrganicCertificate] = Actions.Shop.ProductsManage,
        };

    private static readonly IReadOnlySet<FilePurpose> CustomerPurposes = new HashSet<FilePurpose>();

    public static bool TryGetRequiredStaffAction(FilePurpose purpose, out string action)
    {
        if (StaffPurposeActions.TryGetValue(purpose, out var found))
        {
            action = found;
            return true;
        }

        action = "";
        return false;
    }

    public static bool IsAllowedForCustomer(FilePurpose purpose) => CustomerPurposes.Contains(purpose);
}
