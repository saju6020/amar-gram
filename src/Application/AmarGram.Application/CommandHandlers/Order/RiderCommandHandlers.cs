using AmarGram.Application.Commands.Order;
using AmarGram.Domain.Aggregates.Order;
using AmarGram.Domain.Exceptions;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using static AmarGram.Application.CommandHandlers.Order.OrderHandlerSupport;

namespace AmarGram.Application.CommandHandlers.Order;

/// <summary>HO-P4 BG-5 -- add a rider to the active branch. The name is unique within the branch (pre-check here, unique index <c>ix_rider_branch_name</c> behind it).</summary>
public sealed class CreateRiderCommandHandler(IAggregateRootRepository<RiderAggregate> riders) : ICommandHandlerAsync<CreateRiderCommand>
{
    public async Task<CommandResponse> HandleAsync(CreateRiderCommand command)
    {
        var name = command.Name.Trim();
        if (await riders.ExistAsync(r => r.BranchId == command.BranchId && r.Name == name))
            return Violation(BusinessViolationCodes.RiderNameAlreadyExists, nameof(command.Name), OrderMessages.RiderNameAlreadyExists, nameof(RiderAggregate));

        var rider = new RiderAggregate(command.RiderId);
        try
        {
            rider.Create(command.BranchId, command.Name, command.MobileNumber, command.IsActive, command.UserContext!);
        }
        catch (DomainRuleViolationException ex)
        {
            return Violation(ex.ErrorCode, ex.PropertyName, ex.Message, nameof(RiderAggregate));
        }

        await riders.SaveAsync(rider, EventPublishOption.InMemoryPublishOnly);
        return Success(rider.Id);
    }
}

public sealed class UpdateRiderCommandHandler(IAggregateRootRepository<RiderAggregate> riders) : ICommandHandlerAsync<UpdateRiderCommand>
{
    public async Task<CommandResponse> HandleAsync(UpdateRiderCommand command)
    {
        var rider = await riders.GetByIdAsync(command.RiderId);
        if (rider is null || rider.BranchId != command.BranchId)
            return Violation(BusinessViolationCodes.RiderNotFound, nameof(command.RiderId), "Rider not found.", nameof(RiderAggregate));

        var name = command.Name.Trim();
        if (await riders.ExistAsync(r => r.BranchId == command.BranchId && r.Name == name && r.Id != command.RiderId))
            return Violation(BusinessViolationCodes.RiderNameAlreadyExists, nameof(command.Name), OrderMessages.RiderNameAlreadyExists, nameof(RiderAggregate));

        try
        {
            rider.Update(command.Name, command.MobileNumber, command.IsActive);
        }
        catch (DomainRuleViolationException ex)
        {
            return Violation(ex.ErrorCode, ex.PropertyName, ex.Message, nameof(RiderAggregate));
        }

        await riders.UpdateAsync(rider, EventPublishOption.InMemoryPublishOnly);
        return Success(rider.Id);
    }
}
