namespace AmarGram.Read.ViewModels;

// HO-POR-001 §12.4. Every type here is the portal's OWN shape (ADR-259): a section reader maps an upstream ViewModel member by member
// into these, so a field added upstream -- possibly staff-only -- cannot leak into the dashboard. No property holds another module's type.

/// <summary>One dashboard section. <see cref="State"/> is a PortalSectionState display name. <see cref="Data"/> is <c>null</c> when the
/// state is <c>Unavailable</c> -- never an empty list, never a zero (ADR-260).</summary>
public sealed record PortalSection<T>(string State, T? Data) where T : class;

/// <summary>The dashboard. A section appears here only once the area that owns its data has been merged and its reader built
/// (HO-POR-001 §17); the JSON simply has no key for a section that does not exist yet.</summary>
public sealed record PortalDashboardViewModel(
    DateTimeOffset GeneratedOn,
    PortalSection<PortalCustomerViewModel> Customer,
    PortalSection<PortalBalancesViewModel> Balances,
    PortalSection<PortalOrdersViewModel> Orders);

public sealed record PortalCustomerViewModel(string FullName);

// ── Orders ──────────────────────────────────────────────────────────────────────────────────────────
public sealed record PortalOrdersViewModel(IReadOnlyList<PortalOrderItemViewModel> Items);

public sealed record PortalOrderItemViewModel(
    Guid OrderId, string OrderNumber, DateTimeOffset PlacedOn, string Status, PortalMoneyViewModel Total, int ItemCount, bool CanReorder,
    string? TrackingNumber);

// ── Balances (guidance only; no payment action exists, ADR-264) ─────────────────────────────────────
public sealed record PortalMoneyViewModel(string Amount, string CurrencyCode);

public sealed record PortalBalancesViewModel(
    bool HasOutstanding, IReadOnlyList<PortalMoneyViewModel> Outstanding, IReadOnlyList<PortalMoneyViewModel> Overdue,
    int OpenInvoiceCount, DateOnly? OldestDueOn, IReadOnlyList<PortalInvoiceItemViewModel> Invoices, string HowToPay);

public sealed record PortalInvoiceItemViewModel(
    Guid InvoiceId, string? InvoiceNumber, DateOnly? IssuedOn, DateOnly? DueOn, PortalMoneyViewModel Total,
    PortalMoneyViewModel BalanceDue, string Status);
