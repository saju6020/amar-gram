using AmarGram.Application.Commands.Account;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;

namespace AmarGram.Application.DataMappers;

public static class StaffAccountMapper
{
    public static StaffAccountCreationDto ToCreationDto(
        this CreateStaffAccountCommand command, MobileNumber? mobile, EmailAddress? email) =>
        new(command.FullName, mobile, email, command.RoleIds, command.UserContext, command.CorrelationId);

    public static StaffRoleChangeDto ToRoleChangeDto(this ChangeStaffRolesCommand command) =>
        new(command.RoleIds, command.UserContext, command.CorrelationId);
}
