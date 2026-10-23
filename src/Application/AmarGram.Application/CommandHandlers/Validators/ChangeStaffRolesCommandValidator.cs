using AmarGram.Application.Commands.Account;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class ChangeStaffRolesCommandValidator : AbstractValidator<ChangeStaffRolesCommand>
{
    public ChangeStaffRolesCommandValidator()
    {
        RuleFor(x => x.StaffAccountId).NotEmpty();
        RuleFor(x => x.RoleIds).NotEmpty().WithErrorCode(BusinessViolationCodes.StaffRolesRequired);
    }
}
