using AmarGram.Application.Commands.Subscription;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

// HO-SUB-001 §11.2 -- shape only: ids non-empty, quantity and interval ranges, fulfilment and its id consistent, text lengths. Date windows (earliest, cut-off,
// horizon) are the aggregate's, because they need the commerce clock. Registered as IValidator<T> (di-registration-guide §3).

internal static class SubscriptionValidationRules
{
    public static bool FulfilmentIdsAgree(SubscriptionFulfilment fulfilment, Guid? addressId, Guid? branchId) =>
        fulfilment == SubscriptionFulfilment.Delivery ? addressId is { } a && a != Guid.Empty && branchId is null : branchId is { } b && b != Guid.Empty && addressId is null;
}

public sealed class CreateSubscriptionCommandValidator : AbstractValidator<CreateSubscriptionCommand>
{
    public CreateSubscriptionCommandValidator()
    {
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.SkuId).NotEmpty();
        RuleFor(x => x.Quantity).InclusiveBetween(1, SubscriptionRules.MaxQuantity);
        RuleFor(x => x.IntervalWeeks).Must(w => SubscriptionRules.AllowedIntervalWeeks.Contains(w)).WithMessage("is not an allowed interval.");
        RuleFor(x => x).Must(x => SubscriptionValidationRules.FulfilmentIdsAgree(x.Fulfilment, x.DeliveryAddressId, x.PickupBranchId))
            .WithName("Fulfilment").WithMessage("A delivery needs an address and a collection needs a branch, not both.");
    }
}

public sealed class ChangeSubscriptionTermsCommandValidator : AbstractValidator<ChangeSubscriptionTermsCommand>
{
    public ChangeSubscriptionTermsCommandValidator()
    {
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.ExpectedVersion).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Quantity).InclusiveBetween(1, SubscriptionRules.MaxQuantity);
        RuleFor(x => x.IntervalWeeks).Must(w => SubscriptionRules.AllowedIntervalWeeks.Contains(w)).WithMessage("is not an allowed interval.");
        RuleFor(x => x).Must(x => SubscriptionValidationRules.FulfilmentIdsAgree(x.Fulfilment, x.DeliveryAddressId, x.PickupBranchId))
            .WithName("Fulfilment").WithMessage("A delivery needs an address and a collection needs a branch, not both.");
    }
}

public sealed class SkipSubscriptionDeliveryCommandValidator : AbstractValidator<SkipSubscriptionDeliveryCommand>
{
    public SkipSubscriptionDeliveryCommandValidator() => RuleFor(x => x.SubscriptionId).NotEmpty();
}

public sealed class PauseSubscriptionCommandValidator : AbstractValidator<PauseSubscriptionCommand>
{
    public PauseSubscriptionCommandValidator() => RuleFor(x => x.SubscriptionId).NotEmpty();
}

public sealed class ResumeSubscriptionCommandValidator : AbstractValidator<ResumeSubscriptionCommand>
{
    public ResumeSubscriptionCommandValidator() => RuleFor(x => x.SubscriptionId).NotEmpty();
}

public sealed class CancelSubscriptionCommandValidator : AbstractValidator<CancelSubscriptionCommand>
{
    public CancelSubscriptionCommandValidator()
    {
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(SubscriptionRules.MaxNoteLength);

        // A customer chooses one of their own reasons; staff must give StaffCancelled and say why (CancellationReasonRequired).
        RuleFor(x => x.Reason).Must(r => r.IsCustomerChoice).When(x => !x.ByStaff).WithMessage("is not a reason a customer can choose.");
        RuleFor(x => x.Reason).Must(r => r == SubscriptionCancellationReason.StaffCancelled).When(x => x.ByStaff)
            .WithErrorCode(BusinessViolationCodes.CancellationReasonRequired).WithMessage("must be StaffCancelled when the shop cancels.");
        RuleFor(x => x.Note).NotEmpty().When(x => x.ByStaff)
            .WithErrorCode(BusinessViolationCodes.CancellationReasonRequired).WithMessage("Give a reason for cancelling this subscription.");
    }
}

public sealed class WithdrawPendingSubscriptionChangesCommandValidator : AbstractValidator<WithdrawPendingSubscriptionChangesCommand>
{
    public WithdrawPendingSubscriptionChangesCommandValidator() => RuleFor(x => x.SubscriptionId).NotEmpty();
}

public sealed class RecordSubscriptionCycleCommandValidator : AbstractValidator<RecordSubscriptionCycleCommand>
{
    public RecordSubscriptionCycleCommandValidator()
    {
        RuleFor(x => x.SubscriptionCycleId).NotEmpty();
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.IdempotencyKey).NotEmpty().MaximumLength(60);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0m, 100m);
        RuleFor(x => x.OrderNumber).NotEmpty().When(x => x.OrderId is not null);
        RuleFor(x => x.OrderStatus).NotEmpty().When(x => x.OrderId is not null);
        RuleFor(x => x.OrderId).Empty().When(x => x.FailureCode is not null).WithMessage("A cycle is either generated or failed.");
        RuleFor(x => x.FailureCode).NotEmpty().When(x => x.OrderId is null);
    }
}

public sealed class SuspendSubscriptionCommandValidator : AbstractValidator<SuspendSubscriptionCommand>
{
    public SuspendSubscriptionCommandValidator() => RuleFor(x => x.SubscriptionId).NotEmpty();
}

public sealed class ReinstateSubscriptionCommandValidator : AbstractValidator<ReinstateSubscriptionCommand>
{
    public ReinstateSubscriptionCommandValidator()
    {
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().WithErrorCode(BusinessViolationCodes.ReinstatementReasonRequired).MaximumLength(SubscriptionRules.MaxNoteLength);
    }
}

public sealed class PlaceSubscriptionOrderCommandValidator : AbstractValidator<PlaceSubscriptionOrderCommand>
{
    public PlaceSubscriptionOrderCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.SubscriptionId).NotEmpty();
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.SkuId).NotEmpty();
        RuleFor(x => x.Quantity).InclusiveBetween(1, SubscriptionRules.MaxQuantity);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0m, 100m);
    }
}
