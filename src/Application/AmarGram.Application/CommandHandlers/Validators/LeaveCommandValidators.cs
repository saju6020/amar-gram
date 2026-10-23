using AmarGram.Application.Commands.Administration;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RequestLeaveCommandValidator : AbstractValidator<RequestLeaveCommand>
{
    public RequestLeaveCommandValidator()
    {
        RuleFor(x => x.LeaveRequestId).NotEmpty();
        RuleFor(x => x.EndsOn).GreaterThanOrEqualTo(x => x.StartsOn);
        // Gate fix 2026-09-26 (SEC LOW, hardening round): unknown/wrongly-cased -> 400, not a 500 --
        // any staff member can reach this endpoint.
        RuleFor(x => x.Kind).NotEmpty().MustBeValidEnumeration<RequestLeaveCommand, LeaveKind>();
        RuleFor(x => x.Note).MaximumLength(LeaveRules.NoteMaxLength).NoControlCharacters();
    }
}

public sealed class ApproveLeaveCommandValidator : AbstractValidator<ApproveLeaveCommand>
{
    public ApproveLeaveCommandValidator()
    {
        RuleFor(x => x.LeaveRequestId).NotEmpty();
        RuleFor(x => x.DecisionNote).MaximumLength(LeaveRules.DecisionNoteMaxLength).NoControlCharacters();
    }
}

public sealed class RejectLeaveCommandValidator : AbstractValidator<RejectLeaveCommand>
{
    public RejectLeaveCommandValidator()
    {
        RuleFor(x => x.LeaveRequestId).NotEmpty();
        RuleFor(x => x.DecisionNote).MaximumLength(LeaveRules.DecisionNoteMaxLength).NoControlCharacters();
    }
}

public sealed class CancelLeaveCommandValidator : AbstractValidator<CancelLeaveCommand>
{
    public CancelLeaveCommandValidator()
    {
        RuleFor(x => x.LeaveRequestId).NotEmpty();
    }
}
