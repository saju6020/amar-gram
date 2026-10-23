namespace CatEcommerce.Read.ViewModels;

public sealed record PersonalDataExportViewModel(
    int SchemaVersion,
    DateTimeOffset ExportedOn,
    CustomerProfileViewModel Profile,
    IReadOnlyList<DeliveryAddressViewModel> Addresses,
    IReadOnlyList<NotificationPreferenceCellViewModel> NotificationPreferences);
