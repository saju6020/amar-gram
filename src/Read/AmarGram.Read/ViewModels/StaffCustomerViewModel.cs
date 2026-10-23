namespace AmarGram.Read.ViewModels;

public sealed record StaffCustomerViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress,
    string RecordStatus, string RegistrationChannel, string Status, Guid? MergedIntoCustomerId);

/// <summary>
/// <paramref name="MobileMatchedOn"/> is <c>"Primary"</c>, <c>"Additional"</c> or <c>null</c>
/// (matched by email, or no mobile search term was given) -- SECURITY gate MEDIUM: additional
/// numbers are never verified, so the screen must be able to show that a hit is only an unverified
/// claim on someone else's number, not treat it the same as a genuine primary-number match.
/// </summary>
public sealed record StaffCustomerSummaryViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress, string RecordStatus, string Status,
    string? MobileMatchedOn);
