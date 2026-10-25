using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.DomainServices;

/// <summary>One cycle as the unpaid streak sees it.</summary>
public sealed record StreakCycle(SubscriptionCycleOutcome Outcome, SubscriptionCycleOrderState? OrderState);

/// <summary>
/// HO-SUB-001 §8.9 (US-SUB-06, ADR-243) -- the unpaid streak, <b>pure</b> and <b>derived</b> from the cycles rather than stored, so a redelivered Orders event
/// can never drift a counter. Takes the most recent cycles in <i>descending</i> cycle date and counts consecutive unpaid ones from the most recent:
/// failed cycles and cycles still awaiting payment are ignored (neither paid nor unpaid yet); cancelled orders are ignored (cancelling before paying is not
/// a default); a confirmed or delivered cycle ends the streak. Unpaid = <c>Expired</c> or <c>Refused</c> (a refused COD parcel, OQ-5).
/// </summary>
public static class UnpaidCycleRule
{
    public static bool IsUnpaid(SubscriptionCycleOrderState? state) =>
        state == SubscriptionCycleOrderState.Expired || state == SubscriptionCycleOrderState.Refused;

    public static int Streak(IEnumerable<StreakCycle> latestFirst)
    {
        var streak = 0;
        foreach (var cycle in latestFirst)
        {
            if (cycle.Outcome == SubscriptionCycleOutcome.Failed) continue;
            if (cycle.OrderState == SubscriptionCycleOrderState.AwaitingPayment || cycle.OrderState == SubscriptionCycleOrderState.Cancelled || cycle.OrderState is null) continue;

            if (!IsUnpaid(cycle.OrderState)) break; // Confirmed or Delivered: they paid
            streak++;
        }

        return streak;
    }
}
