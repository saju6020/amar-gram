using AmarGram.Application.Commands.Administration;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class AssignStaffBranchesCommandValidator : AbstractValidator<AssignStaffBranchesCommand>
{
    public AssignStaffBranchesCommandValidator()
    {
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.BranchIds).NotEmpty();
        RuleFor(x => x.PrimaryBranchId).NotEmpty();
    }
}
