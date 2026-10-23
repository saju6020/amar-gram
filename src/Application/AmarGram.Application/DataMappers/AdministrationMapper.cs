using AmarGram.Application.Commands.Administration;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.DataMappers;

/// <summary>HO-ADM-001 §11.3. Static <c>ToDomainDto()</c> extensions; <c>UserContext</c>/
/// <c>CorrelationId</c> passed through from the command.
///
/// Gate fix 2026-09-26 (SEC LOW, hardening round): every enum-typed command field is parsed with
/// <see cref="ParseEnum{T}"/>/<see cref="ParseNullableEnum{T}"/> (<c>EnumerationParsing</c>,
/// case-insensitive) instead of <c>Enumeration.FromDisplayName</c> directly -- the command's own
/// validator now rejects an unrecognised value with <c>MustBeValidEnumeration</c> before this mapper
/// ever runs, but a case variant (`"page"`, not `"Page"`) is valid and must not still throw here.
/// </summary>
public static class AdministrationMapper
{
    public static BranchCreateDto ToDomainDto(this CreateBranchCommand c) =>
        new(c.Code, c.Name, c.TimeZoneId, c.AddressLine, c.PhoneNumber, c.Email, c.UserContext!, c.CorrelationId);

    public static BranchDetailsUpdateDto ToDomainDto(this UpdateBranchDetailsCommand c) =>
        new(c.Name, c.TimeZoneId, c.AddressLine, c.PhoneNumber, c.Email, c.UserContext!, c.CorrelationId);

    public static BranchWeeklyHoursDto ToDomainDto(this SetBranchWeeklyHoursCommand c) =>
        new(c.Intervals, c.UserContext!, c.CorrelationId);

    public static BranchActivationDto ToDomainDto(this SetBranchActivationCommand c) =>
        new(c.IsActive, c.UserContext!, c.CorrelationId);

    public static BranchClosureCreateDto ToDomainDto(this CreateBranchClosureCommand c) =>
        new(c.BranchId, c.StartsOn, c.EndsOn, ParseEnum<ClosureKind>(c.Kind), c.Reason, c.PartialFrom, c.PartialTo, c.UserContext!, c.CorrelationId);

    public static StaffBranchAssignDto ToDomainDto(this AssignStaffBranchesCommand c) =>
        new(c.BranchIds, c.PrimaryBranchId, c.UserContext!, c.CorrelationId);

    public static RosterCurrentPatternSetDto ToCurrentPatternDto(this SetRosterPatternCommand c, DateOnly today) =>
        new(c.Slots, today, c.UserContext!, c.CorrelationId);

    public static RosterNextPatternScheduleDto ToNextPatternDto(this SetRosterPatternCommand c, DateOnly today) =>
        new(c.Slots, c.EffectiveFrom!.Value, today, c.UserContext!, c.CorrelationId);

    public static RosterExceptionCreateDto ToDomainDto(this CreateRosterExceptionCommand c) =>
        new(c.StaffAccountId, c.BranchId, c.Date, ParseEnum<RosterExceptionKind>(c.Kind), c.Starts, c.Ends, c.Reason, c.UserContext!, c.CorrelationId);

    public static LeaveRequestCreateDto ToDomainDto(this RequestLeaveCommand c, Guid staffAccountId) =>
        new(staffAccountId, c.StartsOn, c.EndsOn, ParseEnum<LeaveKind>(c.Kind), c.Note, c.UserContext!, c.CorrelationId);

    public static TaxClassCreateDto ToDomainDto(this CreateTaxClassCommand c) => new(c.Code, c.Name, c.UserContext!, c.CorrelationId);

    public static TaxClassUpdateDto ToDomainDto(this UpdateTaxClassCommand c) => new(c.Name, c.IsActive, c.UserContext!, c.CorrelationId);

    public static TaxRateCreateDto ToDomainDto(this SetTaxRateCommand c, DateTimeOffset now) =>
        new(c.TaxClassId, c.RatePercent, c.EffectiveFrom, now, c.UserContext!, c.CorrelationId);

    public static BusinessSettingsChangeDto ToDomainDto(this ChangeBusinessSettingsCommand c) =>
        new(c.Changes.Select(x => new SettingChangeInput(x.Key, x.Value)).ToList(), c.UserContext!, c.CorrelationId);

    public static BusinessSettingsClearOverrideDto ToDomainDto(this ClearBranchSettingOverrideCommand c) =>
        new(c.Key, c.UserContext!, c.CorrelationId);

    public static ContentItemCreateDto ToDomainDto(this CreateContentItemCommand c) =>
        new(ParseEnum<ContentKind>(c.Kind), c.Slug, c.Title, c.DraftBody,
            ParseNullableEnum<BannerPlacement>(c.Placement),
            c.LinkUrl, c.VisibleFrom, c.VisibleTo, c.SortOrder, c.UserContext!, c.CorrelationId);

    public static ContentItemDraftEditDto ToDomainDto(this EditContentDraftCommand c) =>
        new(c.Title, c.DraftBody, ParseNullableEnum<BannerPlacement>(c.Placement),
            c.LinkUrl, c.VisibleFrom, c.VisibleTo, c.SortOrder, c.UserContext!, c.CorrelationId);

    public static ContentItemPublishDto ToDomainDto(this PublishContentItemCommand c, DateTimeOffset now) =>
        new(now, c.UserContext!, c.CorrelationId);

    public static ContentItemUnpublishDto ToDomainDto(this UnpublishContentItemCommand c) => new(c.UserContext!, c.CorrelationId);

    public static PolicyDocumentCreateDto ToDomainDto(this CreatePolicyDocumentCommand c) =>
        new(c.Key, c.Title, c.RequiresAcceptance, c.UserContext!, c.CorrelationId);

    public static PolicyVersionCreateDto ToDomainDto(this PublishPolicyVersionCommand c, int versionNumber, DateTimeOffset now, bool requiresAcceptance) =>
        new(c.PolicyKey, versionNumber, c.Body, now, c.ChangeSummary, requiresAcceptance, c.UserContext!, c.CorrelationId);

    public static PolicyAcceptanceCreateDto ToDomainDto(this AcceptPolicyVersionCommand c, DateTimeOffset acceptedOn) =>
        new(c.UserContext.UserId, c.PolicyKey, c.VersionNumber, acceptedOn, c.IpAddress, c.UserContext!, c.CorrelationId);

    public static SetMaintenanceModeDto ToDomainDto(this SetMaintenanceModeCommand c, DateTimeOffset changedOn) =>
        new(c.MaintenanceMode, c.Message, changedOn, c.UserContext!, c.CorrelationId);

    /// <summary>The command's own <c>MustBeValidEnumeration</c> validator rule has already rejected
    /// an unrecognised or malformed value before this mapper runs -- this throws only if that
    /// invariant is ever broken (a future command field added without the matching validator rule),
    /// rather than silently mis-mapping.</summary>
    private static T ParseEnum<T>(string value) where T : Enumeration
    {
        if (!EnumerationParsing.TryParse<T>(value, out var result) || result is null)
        {
            throw new InvalidOperationException(
                $"'{value}' is not a recognised {typeof(T).Name}. This should have been rejected by the command's own validator before the mapper ever ran.");
        }

        return result;
    }

    /// <summary>Gate fix 2026-09-26 (SEC LOW, fifth pass): a blank value (<c>""</c>, whitespace)
    /// is not the same as an absent one to a plain <c>value is null</c> check -- it fell through to
    /// <see cref="ParseEnum{T}"/>, which called <see cref="EnumerationParsing.TryParse{T}"/> (itself
    /// correctly treating blank as "no value", returning a null result with no error), and then
    /// threw on that null result, an unhandled 500 on a blank <c>placement</c>. Blank is now treated
    /// as absent here too, matching <c>EnumerationParsing.TryParse</c>'s own contract.</summary>
    private static T? ParseNullableEnum<T>(string? value) where T : Enumeration =>
        string.IsNullOrWhiteSpace(value) ? null : ParseEnum<T>(value);
}
