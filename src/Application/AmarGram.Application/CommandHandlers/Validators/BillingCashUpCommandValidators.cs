using AmarGram.Application.Commands.Billing;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RecordCashCountCommandValidator : AbstractValidator<RecordCashCountCommand>
{
    public RecordCashCountCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.BusinessDate).Must(d => d.Year >= 2000).WithMessage("is not a valid date.");
        RuleFor(x => x.CountedCash).MoneyShape(allowZero: true);
        // HO-P4 BG-20: a per-source count. The aggregate checks the keys against the day's own sources.
        RuleFor(x => x.Counts).Must(c => c is null || c.Count <= 50).WithMessage("has too many sources.");
        RuleForEach(x => x.Counts).ChildRules(line =>
        {
            line.RuleFor(c => c.SourceKey).NotEmpty().MaximumLength(60).NoControlCharacters();
            line.RuleFor(c => c.CountedCash).MoneyShape(allowZero: true);
        });
        RuleFor(x => x.Explanation).MaximumLength(BillingRules.MaxReasonLength).NoControlCharacters();
    }
}

public sealed class CloseCashUpCommandValidator : AbstractValidator<CloseCashUpCommand>
{
    public CloseCashUpCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.BusinessDate).Must(d => d.Year >= 2000).WithMessage("is not a valid date.");
        RuleFor(x => x.ExpectedVersion).GreaterThanOrEqualTo(0);
    }
}
