using AmarGram.Application.Commands.Administration;
using FluentValidation;

namespace AmarGram.Application.CommandHandlers.Validators;

public sealed class SetMaintenanceModeCommandValidator : AbstractValidator<SetMaintenanceModeCommand>
{
    public SetMaintenanceModeCommandValidator() => RuleFor(x => x.Message).MaximumLength(500).NoControlCharacters();
}
