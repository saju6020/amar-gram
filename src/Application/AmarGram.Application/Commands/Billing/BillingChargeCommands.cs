using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Commands.Billing;

/// <summary>HO-BIL-001 §11.1 C2 -- a desk charge: a free-text fee (<see cref="Description"/>,
/// <see cref="UnitPrice"/>, <see cref="TaxClassId"/>). The branch is the caller's active branch.</summary>
public sealed class RecordManualChargeCommand : Command
{
    public required Guid ChargeId { get; init; }
    public required Guid CustomerId { get; init; }
    public required Guid BranchId { get; init; }
    public string? Description { get; init; }
    public decimal? UnitPrice { get; init; }
    public Guid? TaxClassId { get; init; }
    public required decimal Quantity { get; init; }
    public decimal LineDiscount { get; init; }
    public required DateOnly ServiceDate { get; init; }

    /// <summary>"Shop" (default) -- a manual charge is the one source that may choose (§8.2).</summary>
    public string? BusinessLine { get; init; }
}

/// <summary>C3 -- void an <b>unbilled</b> charge. A charge on an invoice is corrected by credit note instead.</summary>
public sealed class VoidChargeCommand : Command
{
    public required Guid ChargeId { get; init; }
    public required Guid BranchId { get; init; }
    public required string Reason { get; init; }
}

