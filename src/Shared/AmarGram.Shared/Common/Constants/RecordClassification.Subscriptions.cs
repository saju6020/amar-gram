using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §8 -- Subscriptions' table classifications, added in the same change that adds the tables (HO-XCT-001 §5.2 C-ALL-1).</summary>
public static partial class RecordClassification
{
    private static readonly IReadOnlyList<TableClassification> SubscriptionEntries =
    [
        // A subscription is the customer's standing instruction, changed in place and audited; it is cancelled, never deleted. It holds ids and a display
        // snapshot of the product name, nothing else personal; a merge reassigns it and an anonymisation cancels it (ADR-247).
        new TableClassification("subscription", "subscription", RecordClass.CurrentState, HardDeletePolicy.AggregateOnly, "HO-SUB-001 §8.2 -- a standing instruction edited in place; cancelled, not deleted (no row is ever removed by code)"),

        // A cycle is the record of what was done on a date (an order raised or a failure) and the evidence for the unpaid streak; it accumulates for years (rule 3).
        new TableClassification("subscription", "subscription_cycle", RecordClass.Operational, HardDeletePolicy.AggregateOnly, "HO-SUB-001 §8.7 -- append-only history of each cycle; holds the order id and a mirrored outcome, never money"),
    ];
}
