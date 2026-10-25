namespace AmarGram.Shared.Common.Constants;

/// <summary>
/// HO-SUB-001 §10.4 -- Subscriptions' own violation codes (ADR-341 per-area partial). Adapted: the cat and prescription codes
/// (<c>CatRequiredForPrescriptionDiet</c>, <c>CatNotAllowedForProduct</c>, <c>PrescriptionAuthorisationRequired</c>) are retired with the clinic (HO-P1),
/// and <c>PickupBranchUnavailable</c> (Orders) replaces <c>PickupBranchNotAvailable</c>. Already declared elsewhere and reused:
/// <c>DeliveryAddressNotFound</c> (Accounts), <c>PaymentMethodUnavailable</c> (Orders), <c>CancellationReasonRequired</c> (base), <c>StaleVersion</c> (Billing).
/// </summary>
public static partial class BusinessViolationCodes
{
    public const string SubscriptionNotFound = nameof(SubscriptionNotFound);
    public const string SkuNotSubscribable = nameof(SkuNotSubscribable);
    public const string InvalidSubscriptionQuantity = nameof(InvalidSubscriptionQuantity);
    public const string InvalidSubscriptionInterval = nameof(InvalidSubscriptionInterval);
    public const string FulfilmentDetailsInvalid = nameof(FulfilmentDetailsInvalid);
    public const string PaymentMethodNotAllowedForFulfilment = nameof(PaymentMethodNotAllowedForFulfilment);
    public const string InvalidFirstDeliveryDate = nameof(InvalidFirstDeliveryDate);
    public const string SubscriptionAlreadyExists = nameof(SubscriptionAlreadyExists);
    public const string SubscriptionLimitReached = nameof(SubscriptionLimitReached);
    public const string InvalidSubscriptionTransition = nameof(InvalidSubscriptionTransition);
    public const string SubscriptionSuspended = nameof(SubscriptionSuspended);
    public const string SubscriptionCannotBeReinstated = nameof(SubscriptionCannotBeReinstated);
    public const string ReinstatementReasonRequired = nameof(ReinstatementReasonRequired);
    public const string NoChangeRequested = nameof(NoChangeRequested);
    public const string NoPendingChange = nameof(NoPendingChange);
    public const string CycleNoLongerSkippable = nameof(CycleNoLongerSkippable);
    public const string SkipAlreadyScheduled = nameof(SkipAlreadyScheduled);
    public const string CycleNotDue = nameof(CycleNotDue);
}
