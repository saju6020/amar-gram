using AmarGram.Application.Commands.Administration;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class RecordAuditLogExportCommandValidator : AbstractValidator<RecordAuditLogExportCommand>
{
    public RecordAuditLogExportCommandValidator()
    {
        RuleFor(x => x.To).GreaterThanOrEqualTo(x => x.From);
    }
}
