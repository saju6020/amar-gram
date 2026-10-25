namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §10.3 -- the fixed limits of a subscription. Adapted: <c>SubscribableCategoryGroups</c> is retired -- HO-P2 made the catalogue a general
/// organic shop, so a product is subscribable when staff mark it <c>IsSubscribable</c> (BG-15), not by category.</summary>
public static class SubscriptionRules
{
    /// <summary>OQ-2: every 2, 4, 6, 8 or 12 weeks.</summary>
    public static readonly IReadOnlyList<int> AllowedIntervalWeeks = [2, 4, 6, 8, 12];

    public const int MaxQuantity = 20;
    public const int MaxLiveSubscriptionsPerCustomer = 20;

    /// <summary>The first delivery may be at most this many days ahead.</summary>
    public const int MaxFirstDeliveryDays = 90;

    public const int MaxNoteLength = 500;
    public const int WorkerBatchSize = 200;

    /// <summary>How many of the latest cycles the unpaid streak reads (§8.9).</summary>
    public const int StreakWindow = 10;

    /// <summary>The latest cycles shown on a customer's subscription (§12.4).</summary>
    public const int CustomerCycleHistory = 12;

    /// <summary>Above this many rows the CSV export answers <c>413</c> (§12.4).</summary>
    public const int MaxExportRows = 50_000;
}
