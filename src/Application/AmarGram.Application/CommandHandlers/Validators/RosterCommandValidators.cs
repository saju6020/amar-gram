using AmarGram.Application.Commands.Administration;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SetRosterPatternCommandValidator : AbstractValidator<SetRosterPatternCommand>
{
    public SetRosterPatternCommandValidator()
    {
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Slots).NotNull();
    }
}

public sealed class CancelScheduledRosterPatternCommandValidator : AbstractValidator<CancelScheduledRosterPatternCommand>
{
    public CancelScheduledRosterPatternCommandValidator()
    {
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}

public sealed class CreateRosterExceptionCommandValidator : AbstractValidator<CreateRosterExceptionCommand>
{
    public CreateRosterExceptionCommandValidator()
    {
        RuleFor(x => x.RosterExceptionId).NotEmpty();
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        // Gate fix 2026-09-26 (SEC LOW, hardening round): unknown/wrongly-cased -> 400, not a 500.
        RuleFor(x => x.Kind).NotEmpty().MustBeValidEnumeration<CreateRosterExceptionCommand, RosterExceptionKind>();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(200).NoControlCharacters();
    }
}

/// <summary>HO-P4 BG-23. <c>Custom</c> is a read-only classification, not a value a caller may set.</summary>
public sealed class SetRosterShiftCommandValidator : AbstractValidator<SetRosterShiftCommand>
{
    public SetRosterShiftCommandValidator()
    {
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Date).Must(d => d.Year >= 2000).WithMessage("is not a valid date.");
        RuleFor(x => x.Shift).NotEmpty().MustBeValidEnumeration<SetRosterShiftCommand, RosterShift>()
            .Must(v => !string.Equals(v, RosterShift.Custom.DisplayName, StringComparison.OrdinalIgnoreCase))
            .WithMessage("must be Morning, Evening or Off.");
    }
}

public sealed class CancelRosterExceptionCommandValidator: AbstractValidator<CancelRosterExceptionCommand>
{
    public CancelRosterExceptionCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.RosterExceptionId).NotEmpty();
    }
}
