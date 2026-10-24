using AmarGram.Domain.Exceptions;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Order;

/// <summary>
/// HO-P4 BG-5 -- an in-house delivery rider: a minimal, staff-managed registry <b>per branch</b>. A dispatch names either a courier (<see cref="CourierAggregate"/>)
/// or a rider; cash on delivery handed to a rider is what the dashboard's "cash on delivery out with riders" figure adds up. A rider is master data an order's
/// shipment points at, so it is deactivated, never deleted. The name is unique within the branch (the handler's check, and a unique index); the optional mobile
/// is normalised by the same <see cref="MobileNumber"/> rule as every other number in the system.
/// </summary>
public sealed class RiderAggregate : AggregateRoot
{
    public Guid BranchId { get; private set; }
    public string Name { get; private set; } = default!;
    public string? MobileNumber { get; private set; }
    public bool IsActive { get; private set; }

    private RiderAggregate() { }

    public RiderAggregate(Guid id) : base(id) { }

    public void Create(Guid branchId, string name, string? mobileNumber, bool isActive, UserContext userContext)
    {
        if (branchId == Guid.Empty) throw Invalid("A rider belongs to a branch.", nameof(BranchId));

        BranchId = branchId;
        Apply(name, mobileNumber, isActive);
        SetDefaultValue(userContext);
        UpdateVersion();
    }

    public void Update(string name, string? mobileNumber, bool isActive)
    {
        Apply(name, mobileNumber, isActive);
        UpdateVersion();
    }

    private void Apply(string name, string? mobileNumber, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > OrderRules.MaxNameLength)
            throw Invalid($"A rider name is required (up to {OrderRules.MaxNameLength} characters).", nameof(Name));

        Name = name.Trim();
        MobileNumber = string.IsNullOrWhiteSpace(mobileNumber) ? null : ValueObjects.MobileNumber.Create(mobileNumber).Value;
        IsActive = isActive;
    }

    private static DomainRuleViolationException Invalid(string message, string property) =>
        new(BusinessViolationCodes.InvalidRider, message, property);
}
