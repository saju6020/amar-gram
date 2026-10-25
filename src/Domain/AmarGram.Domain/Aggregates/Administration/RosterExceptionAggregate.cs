using AmarGram.Domain.Events.Administration;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Administration;

/// <summary>HO-ADM-001 §8.4. Unbounded over time -- its own root.</summary>
public sealed class RosterExceptionAggregate : AggregateRoot
{
    public Guid StaffAccountId { get; private set; }
    public Guid BranchId { get; private set; }
    public DateOnly Date { get; private set; }
    public RosterExceptionKind Kind { get; private set; } = default!;
    public TimeOnly Starts { get; private set; }
    public TimeOnly Ends { get; private set; }
    public string Reason { get; private set; } = default!;
    public bool IsCancelled { get; private set; }

    private RosterExceptionAggregate() { }

    public RosterExceptionAggregate(Guid id) : base(id) { }

    public void Create(RosterExceptionCreateDto dto)
    {
        Validate(dto);

        StaffAccountId = dto.StaffAccountId;
        BranchId = dto.BranchId;
        Date = dto.Date;
        Kind = dto.Kind;
        Starts = dto.Starts;
        Ends = dto.Ends;
        Reason = dto.Reason;
        IsCancelled = false;

        SetDefaultValue(dto.UserContext);

        AddDomainEvent(new RosterExceptionCreatedEvent { RosterExceptionId = Id, StaffAccountId = StaffAccountId, BranchId = BranchId, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext });
        UpdateVersion();
    }

    private static void Validate(RosterExceptionCreateDto dto)
    {
        if (dto.Starts >= dto.Ends)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidShiftSlot, "A start must be before its end.", nameof(dto.Starts));
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Length > 200)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidShiftSlot, "A reason is required.", nameof(dto.Reason));
    }

    /// <summary>HO-P4 BG-23. A roster-grid cell re-sets an exception it created earlier (same deterministic id, see
    /// <see cref="RosterCellIds"/>) instead of stacking a new row each click: same checks as <see cref="Create"/>, the
    /// exception becomes active again.</summary>
    public void Reshape(RosterExceptionCreateDto dto)
    {
        if (dto.StaffAccountId != StaffAccountId || dto.BranchId != BranchId || dto.Date != Date)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidShiftSlot, "A roster exception cannot move to another person, branch or date.", nameof(dto.Date));

        Validate(dto);

        Kind = dto.Kind;
        Starts = dto.Starts;
        Ends = dto.Ends;
        Reason = dto.Reason;
        IsCancelled = false;

        AddDomainEvent(new RosterExceptionCreatedEvent { RosterExceptionId = Id, StaffAccountId = StaffAccountId, BranchId = BranchId, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext });
        UpdateVersion();
    }

    /// <summary>HO-P4 BG-23. Switches a cell's own exception off. Unlike <see cref="Cancel"/> this has no past-date rule -- the
    /// caller (the cell command) has already refused a past date -- and today's cell must be editable. No-op if already off.</summary>
    public void Retire(RosterExceptionRetireDto dto)
    {
        if (IsCancelled) return;

        IsCancelled = true;

        AddDomainEvent(new RosterExceptionCancelledEvent { RosterExceptionId = Id, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext });
        UpdateVersion();
    }

    public void Cancel(RosterExceptionCancelDto dto)
    {
        if (Date <= dto.Today)
            throw new DomainRuleViolationException(BusinessViolationCodes.PastClosureCannotBeCancelled, "A past roster exception cannot be cancelled.", nameof(Date));

        IsCancelled = true;

        AddDomainEvent(new RosterExceptionCancelledEvent { RosterExceptionId = Id, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext });
        UpdateVersion();
    }
}

/// <summary>HO-P4 BG-23. The two exception rows behind one roster-grid cell, with deterministic ids so a click "loads or creates" its rows
/// (the <see cref="CashUpIds"/>-style pair-derived id): <c>Base</c> is a whole-day <c>ShiftCancelled</c> that clears the weekly pattern;
/// <c>Shift</c> is the <c>ExtraShift</c> that carries Morning or Evening (retired for Off).</summary>
public enum RosterCellPart
{
    Base,
    Shift,
}

public static class RosterCellIds
{
    public static Guid For(Guid staffAccountId, Guid branchId, DateOnly date, RosterCellPart part)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"roster-cell:{staffAccountId:N}:{branchId:N}:{date:yyyy-MM-dd}:{part}"));
        return new Guid(bytes.AsSpan(0, 16));
    }
}
