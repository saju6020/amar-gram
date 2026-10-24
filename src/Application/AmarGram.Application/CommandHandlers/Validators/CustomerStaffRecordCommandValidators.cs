using AmarGram.Application.Commands.Account;
using AmarGram.Shared.Common.Constants;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

/// <summary>HO-P4 BG-19 -- shape only; the length, count and content rules are the aggregate's.</summary>
public sealed class AddCustomerNoteCommandValidator : AbstractValidator<AddCustomerNoteCommand>
{
    public AddCustomerNoteCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.NoteId).NotEmpty();
        RuleFor(x => x.Text).NotEmpty().MaximumLength(CustomerStaffRecordRules.NoteMaxLength * 2);
    }
}

public sealed class SetCustomerTagsCommandValidator : AbstractValidator<SetCustomerTagsCommand>
{
    public SetCustomerTagsCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Tags).NotNull().Must(t => t is null || t.Count <= CustomerStaffRecordRules.MaxTags * 5)
            .WithMessage("has too many tags.");
    }
}

public sealed class RequestCustomerPasswordResetCommandValidator : AbstractValidator<RequestCustomerPasswordResetCommand>
{
    public RequestCustomerPasswordResetCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.TokenId).NotEmpty();
    }
}
