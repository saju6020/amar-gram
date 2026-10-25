namespace AmarGram.Read.ViewModels;

/// <summary>
/// HO-P4 BG-19 adds the profile summary: <paramref name="CustomerSince"/> (when the record was created), <paramref name="Area"/> (district of the
/// default delivery address, null when there is none), <paramref name="OrderCount"/> (orders not cancelled) and <paramref name="LifetimeSpend"/>
/// (paid minus refunded on those orders, in the business currency), plus the staff <paramref name="Tags"/> and <paramref name="NoteCount"/>.
/// For an anonymised customer area and tags are empty by construction (the address book and staff record are cleared).
/// </summary>
public sealed record StaffCustomerViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress,
    string RecordStatus, string RegistrationChannel, string Status, Guid? MergedIntoCustomerId,
    DateTimeOffset CustomerSince, string? Area, int OrderCount, MoneyViewModel LifetimeSpend,
    IReadOnlyList<string> Tags, int NoteCount);

/// <summary>
/// <paramref name="MobileMatchedOn"/> is <c>"Primary"</c>, <c>"Additional"</c> or <c>null</c>
/// (matched by email, or no mobile search term was given) -- SECURITY gate MEDIUM: additional
/// numbers are never verified, so the screen must be able to show that a hit is only an unverified
/// claim on someone else's number, not treat it the same as a genuine primary-number match.
/// </summary>
public sealed record StaffCustomerSummaryViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress, string RecordStatus, string Status,
    string? MobileMatchedOn);

/// <summary>HO-P4 BG-19. One row of the browsable customer list.</summary>
public sealed record StaffCustomerListItemViewModel(
    Guid Id, string FullName, string? MobileNumber, string? EmailAddress, string RecordStatus, string Status,
    DateTimeOffset CustomerSince, string? Area, IReadOnlyList<string> Tags);

/// <summary>HO-P4 BG-19. A staff note: who wrote it (the id, and the name as it is now) and when. Newest first.</summary>
public sealed record CustomerNoteViewModel(Guid Id, string Text, Guid AuthorStaffId, string? AuthorName, DateTimeOffset CreatedOn);
