using AmarGram.Application.Commands.Order;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

/// <summary>HO-P4 BG-5 -- shape only. Whether the mobile is a real number and the name is free at the branch are the aggregate's and the handler's.</summary>
public sealed class CreateRiderCommandValidator : AbstractValidator<CreateRiderCommand>
{
    public CreateRiderCommandValidator()
    {
        RuleFor(x => x.RiderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(OrderRules.MaxNameLength).NoControlCharacters();
        RuleFor(x => x.MobileNumber).MaximumLength(30).NoControlCharacters();
    }
}

public sealed class UpdateRiderCommandValidator : AbstractValidator<UpdateRiderCommand>
{
    public UpdateRiderCommandValidator()
    {
        RuleFor(x => x.RiderId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(OrderRules.MaxNameLength).NoControlCharacters();
        RuleFor(x => x.MobileNumber).MaximumLength(30).NoControlCharacters();
    }
}
