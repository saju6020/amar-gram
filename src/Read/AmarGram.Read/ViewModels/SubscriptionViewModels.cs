namespace AmarGram.Read.ViewModels;

// HO-SUB-001 §12.4 -- the contract HO-SUB-002 consumes. JSON camelCase; local dates yyyy-MM-dd; instants ISO-8601 with offset; money { amount: "1450.00", currencyCode }.
// Every view carries commerceTimeZoneId. No field here is a token, card or gateway reference (ADR-238).

public sealed record SubscriptionProductViewModel(Guid SkuId, string ProductName, string VariantLabel, string? ImageUrl, bool IsAvailable);

public sealed record SubscriptionAddressViewModel(Guid Id, string Label, string Line1, string City);

public sealed record SubscriptionBranchViewModel(Guid Id, string Name);

public sealed record SubscriptionTermsViewModel(
    int Quantity, int IntervalWeeks, string Fulfilment, SubscriptionAddressViewModel? DeliveryAddress, bool DeliveryAddressMissing,
    SubscriptionBranchViewModel? PickupBranch, string PaymentMethod);

public sealed record SubscriptionPendingViewModel(SubscriptionTermsViewModel? Terms, bool Skip, string? StatusChange, DateOnly? AppliesFromCycleOn);

public sealed record SubscriptionEstimateViewModel(
    MoneyViewModel UnitPrice, int Quantity, MoneyViewModel Subtotal, string DiscountPercent, MoneyViewModel DiscountAmount, MoneyViewModel EstimatedTotal, string Note);

public sealed record SubscriptionCycleViewModel(
    Guid Id, DateOnly CycleOn, string Outcome, string? FailureReason, Guid? OrderId, string? OrderNumber, string? OrderState, DateTimeOffset? PaymentExpiresOn, string DiscountPercent);

public sealed record SubscriptionViewModel(
    Guid Id,
    int Version,
    string Status,
    string? SuspensionReason,
    SubscriptionProductViewModel Product,
    SubscriptionTermsViewModel Terms,
    DateOnly? NextDeliveryOn,
    DateTimeOffset? ChangeCutoffOn,
    bool IsLocked,
    DateOnly? FollowingDeliveryOn,
    DateOnly? SkippableCycleOn,
    SubscriptionPendingViewModel? Pending,
    SubscriptionEstimateViewModel? Estimate,
    IReadOnlyList<string> AllowedActions,
    SubscriptionCycleViewModel? LastCycle,
    DateOnly StartedOn,
    DateTimeOffset? CancelledOn,
    string CommerceTimeZoneId);

/// <summary>The customer's detail: the view and its latest cycles (<c>…/{id}/cycles?pageNumber</c> for more).</summary>
public sealed record CustomerSubscriptionDetailViewModel(SubscriptionViewModel Subscription, IReadOnlyList<SubscriptionCycleViewModel> Cycles);

public sealed record SubscriptionOptionsViewModel(
    SubscriptionProductViewModel Sku,
    MoneyViewModel? UnitPrice,
    bool Subscribable,
    string? NotSubscribableReason,
    IReadOnlyList<int> AllowedIntervalWeeks,
    int MaxQuantity,
    string DiscountPercent,
    DateOnly EarliestFirstDeliveryOn,
    DateOnly LatestFirstDeliveryOn,
    int ChangeCutoffDays,
    int PreChargeNoticeDays,
    Guid? ExistingSubscriptionId,
    string CommerceTimeZoneId);

public sealed record SubscriptionPaymentMethodViewModel(string Method, bool IsAvailable, string? UnavailableReason);

// ── staff ───────────────────────────────────────────────────────────────────────────────────

public sealed record SubscriptionCustomerViewModel(Guid Id, string Name, string? Mobile);

public sealed record StaffSubscriptionRowViewModel(
    Guid Id,
    SubscriptionCustomerViewModel Customer,
    SubscriptionProductViewModel Product,
    int Quantity,
    int IntervalWeeks,
    string Status,
    string? SuspensionReason,
    DateOnly? NextDeliveryOn,
    string PaymentMethod,
    int UnpaidStreak,
    SubscriptionCycleViewModel? LastCycle);

public sealed record UnpaidSubscriptionViewModel(
    Guid Id,
    SubscriptionCustomerViewModel Customer,
    SubscriptionProductViewModel Product,
    string Status,
    string Group,
    int UnpaidStreak,
    IReadOnlyList<SubscriptionCycleViewModel> UnpaidCycles);

public sealed record StaffSubscriptionDetailViewModel(
    SubscriptionViewModel Subscription,
    SubscriptionCustomerViewModel Customer,
    IReadOnlyList<SubscriptionCycleViewModel> Cycles,
    string? CancellationReason,
    string? CancellationNote,
    DateTimeOffset? SuspendedOn,
    StaffReinstatementViewModel? Reinstatement,
    IReadOnlyList<string> AllowedStaffActions);

public sealed record StaffReinstatementViewModel(DateTimeOffset ReinstatedOn, Guid ReinstatedBy, string Reason);

/// <summary>The customer-page panel (HO-P4 customer "Subscriptions" tab): the live subscriptions and the counts of the rest.</summary>
public sealed record CustomerSubscriptionSummaryViewModel(IReadOnlyList<SubscriptionViewModel> Live, int CancelledCount, int SuspendedCount);

/// <summary>The dashboard's "Subscription orders due tomorrow" (BG-15): active subscriptions whose next order is raised on <c>DueOn</c> (tomorrow in the commerce zone).</summary>
public sealed record SubscriptionDueTomorrowViewModel(DateOnly DueOn, int Count, int LiveCount, int SuspendedCount, string CommerceTimeZoneId);

// ── worker ──────────────────────────────────────────────────────────────────────────────────

public sealed record PreChargeNoticeCandidate(Guid SubscriptionId, Guid CustomerId, DateOnly CycleOn, string ProductName, int Quantity, string PaymentMethod, string EstimatedAmount);

public sealed record DueSubscriptionCycle(Guid SubscriptionId, DateOnly CycleOn);
