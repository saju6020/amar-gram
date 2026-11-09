using AmarGram.Domain.Exceptions;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.DomainServices;

/// <summary>The schedule-relevant slice of a subscription, so the aggregate and the read side apply exactly one set of rules (HO-SUB-001 §12.6).</summary>
public sealed record ScheduleState(
    SubscriptionStatus Status,
    SubscriptionTerms Terms,
    SubscriptionTerms? PendingTerms,
    bool PendingSkip,
    SubscriptionPendingStatusChange? PendingStatusChange,
    DateOnly? NextDeliveryOn,
    DateOnly? NextDeliverySetOn,
    DateOnly? LastCycleOn,
    DateOnly? LastSkippedOn);

/// <summary>What a schedule change decided: the new state and what to tell the person (US-SUB-02 AC2).</summary>
public sealed record ScheduleChange(ScheduleState State, bool AppliedImmediately, DateOnly? AppliesFromCycleOn, DateOnly? LockedCycleOn, SubscriptionChangeKind Kind);

public enum SubscriptionChangeKind { TermsChanged, Skipped, Paused, Resumed, Cancelled, Withdrawn }

/// <summary>The action names <c>allowedActions[]</c> uses (HO-SUB-001 §12.4).</summary>
public static class SubscriptionActions
{
    public const string ChangeTerms = "ChangeTerms";
    public const string Skip = "Skip";
    public const string Pause = "Pause";
    public const string Resume = "Resume";
    public const string Cancel = "Cancel";
    public const string WithdrawPending = "WithdrawPending";
}

/// <summary>
/// HO-SUB-001 §8.5 (ADR-239), US-SUB-02 -- the schedule, the cut-off and pending changes, <b>pure</b>. Before the cut-off a change applies to the next delivery;
/// after it the upcoming order is committed and the change is <i>scheduled</i> for the following cycle, and the response names that date. The aggregate calls
/// these functions for every mutation and the read side calls the same ones for <c>allowedActions</c>, <c>isLocked</c> and <c>skippableCycleOn</c>, so a
/// screen can never offer what the server would refuse.
/// </summary>
public static class SubscriptionSchedule
{
    public static bool IsLocked(ScheduleState s, SubscriptionClock clock) =>
        s.Status == SubscriptionStatus.Active && s.NextDeliveryOn is { } next && clock.IsLocked(next);

    /// <summary><c>NextDeliveryOn + 7 x (pending interval ?? current interval)</c>: the cycle after the locked one.</summary>
    public static DateOnly? FollowingCycleOn(ScheduleState s) =>
        s.NextDeliveryOn?.AddDays(7 * (s.PendingTerms?.IntervalWeeks ?? s.Terms.IntervalWeeks));

    /// <summary>The cycle a person may skip right now: the next one before the cut-off, the following one after it; null when nothing can be skipped.</summary>
    public static DateOnly? SkippableCycleOn(ScheduleState s, SubscriptionClock clock)
    {
        if (s.Status != SubscriptionStatus.Active || s.NextDeliveryOn is not { } next || s.PendingStatusChange is not null) return null;
        if (!clock.IsLocked(next)) return next;
        return s.PendingSkip ? null : FollowingCycleOn(s);
    }

    /// <summary>§8.8 -- <c>cycleOn - max(noticeDays, cutoffDays + 1)</c>: the notice always lands before the cut-off so its skip link works.</summary>
    public static DateOnly NoticeDateFor(DateOnly cycleOn, int noticeDays, int cutoffDays) => cycleOn.AddDays(-Math.Max(noticeDays, cutoffDays + 1));

    public static IReadOnlyList<string> AllowedActions(ScheduleState s, SubscriptionClock clock)
    {
        var actions = new List<string>();
        var hasPending = s.PendingTerms is not null || s.PendingSkip || s.PendingStatusChange is not null;
        var cancelPending = s.PendingStatusChange == SubscriptionPendingStatusChange.Cancel;

        if (s.Status == SubscriptionStatus.Active && !cancelPending)
        {
            actions.Add(SubscriptionActions.ChangeTerms);
            if (SkippableCycleOn(s, clock) is not null) actions.Add(SubscriptionActions.Skip);
            if (s.PendingStatusChange is null) actions.Add(SubscriptionActions.Pause);
            actions.Add(SubscriptionActions.Cancel);
        }
        else if (s.Status == SubscriptionStatus.Paused)
        {
            actions.AddRange([SubscriptionActions.ChangeTerms, SubscriptionActions.Resume, SubscriptionActions.Cancel]);
        }
        else if (s.Status == SubscriptionStatus.Suspended)
        {
            actions.Add(SubscriptionActions.Cancel);
        }

        if (hasPending && s.Status != SubscriptionStatus.Cancelled) actions.Add(SubscriptionActions.WithdrawPending);
        return actions;
    }

    // ── changes ─────────────────────────────────────────────────────────────────────────────────

    public static ScheduleChange ChangeTerms(ScheduleState s, SubscriptionTerms terms, SubscriptionClock clock)
    {
        if (s.Status != SubscriptionStatus.Active && s.Status != SubscriptionStatus.Paused) throw Invalid(s.Status, "changed");
        if (s.PendingStatusChange == SubscriptionPendingStatusChange.Cancel) throw Invalid(s.Status, "changed after it has been cancelled");
        if (terms == (s.PendingTerms ?? s.Terms)) throw new DomainRuleViolationException(BusinessViolationCodes.NoChangeRequested, SubscriptionMessages.NoChangeRequested, nameof(terms));

        // A paused subscription has no locked cycle: the change is immediate and applies when it is resumed.
        if (s.Status == SubscriptionStatus.Paused)
            return new(s with { Terms = terms, PendingTerms = null }, true, null, null, SubscriptionChangeKind.TermsChanged);

        var next = s.NextDeliveryOn!.Value;
        if (!clock.IsLocked(next))
        {
            var changed = s with { Terms = terms, PendingTerms = null };
            if (terms.IntervalWeeks != s.Terms.IntervalWeeks && s.LastCycleOn is { } last)
            {
                var recomputed = last.AddDays(7 * terms.IntervalWeeks);
                changed = changed with { NextDeliveryOn = recomputed > clock.EarliestDeliveryOn ? recomputed : clock.EarliestDeliveryOn, NextDeliverySetOn = clock.Today };
            }

            return new(changed, true, changed.NextDeliveryOn, null, SubscriptionChangeKind.TermsChanged);
        }

        var pending = terms == s.Terms ? null : terms;
        return new(s with { PendingTerms = pending }, false, next.AddDays(7 * terms.IntervalWeeks), next, SubscriptionChangeKind.TermsChanged);
    }

    public static ScheduleChange Skip(ScheduleState s, DateOnly cycleOn, SubscriptionClock clock)
    {
        if (s.Status != SubscriptionStatus.Active) throw Invalid(s.Status, "skipped");
        if (s.PendingStatusChange is not null) throw Invalid(s.Status, "skipped while it is about to " + s.PendingStatusChange.DisplayName.ToLowerInvariant());

        var next = s.NextDeliveryOn!.Value;
        if (!clock.IsLocked(next))
        {
            if (cycleOn != next) throw NotSkippable(cycleOn, next);
            var moved = s with { NextDeliveryOn = next.AddDays(7 * s.Terms.IntervalWeeks), LastSkippedOn = cycleOn };
            return new(moved, true, moved.NextDeliveryOn, null, SubscriptionChangeKind.Skipped);
        }

        var following = FollowingCycleOn(s)!.Value;
        if (cycleOn == following && s.PendingSkip)
            throw new DomainRuleViolationException(BusinessViolationCodes.SkipAlreadyScheduled, $"The delivery on {SubscriptionMessages.Day(following)} is already set to be skipped.", nameof(cycleOn));
        if (cycleOn != following) throw NotSkippable(cycleOn, s.PendingSkip ? null : following);

        return new(s with { PendingSkip = true }, false, following, next, SubscriptionChangeKind.Skipped);
    }

    public static ScheduleChange Pause(ScheduleState s, SubscriptionClock clock)
    {
        if (s.Status != SubscriptionStatus.Active) throw Invalid(s.Status, "paused");
        if (s.PendingStatusChange is not null) throw Invalid(s.Status, "paused while it is about to " + s.PendingStatusChange.DisplayName.ToLowerInvariant());

        var next = s.NextDeliveryOn!.Value;
        if (!clock.IsLocked(next))
            return new(s with { Status = SubscriptionStatus.Paused, NextDeliveryOn = null, NextDeliverySetOn = null, PendingTerms = null, PendingSkip = false }, true, null, null, SubscriptionChangeKind.Paused);

        return new(s with { PendingStatusChange = SubscriptionPendingStatusChange.Pause }, false, FollowingCycleOn(s), next, SubscriptionChangeKind.Paused);
    }

    /// <summary>Resume from <c>Paused</c> only; a suspension is lifted by staff (§8.9, OQ-6).</summary>
    public static ScheduleChange Resume(ScheduleState s, DateOnly? firstDeliveryOn, SubscriptionClock clock)
    {
        if (s.Status == SubscriptionStatus.Suspended)
            throw new DomainRuleViolationException(BusinessViolationCodes.SubscriptionSuspended, SubscriptionMessages.SubscriptionSuspendedMessage(null, 0), nameof(s.Status));
        if (s.Status != SubscriptionStatus.Paused) throw Invalid(s.Status, "resumed");

        var date = ValidFirstDate(firstDeliveryOn, clock);
        return new(s with { Status = SubscriptionStatus.Active, NextDeliveryOn = date, NextDeliverySetOn = clock.Today }, true, date, null, SubscriptionChangeKind.Resumed);
    }

    /// <summary>Cancel from <c>Active</c> (immediately, or scheduled after a locked cycle), <c>Paused</c> or <c>Suspended</c>.</summary>
    public static ScheduleChange Cancel(ScheduleState s, SubscriptionClock clock)
    {
        if (s.Status == SubscriptionStatus.Cancelled) throw Invalid(s.Status, "cancelled");

        if (s.Status == SubscriptionStatus.Active && s.NextDeliveryOn is { } next && clock.IsLocked(next))
        {
            if (s.PendingStatusChange == SubscriptionPendingStatusChange.Cancel)
                throw new DomainRuleViolationException(BusinessViolationCodes.NoChangeRequested, "This subscription is already set to end after your next delivery.", nameof(s.PendingStatusChange));
            return new(s with { PendingStatusChange = SubscriptionPendingStatusChange.Cancel, PendingSkip = false }, false, next, next, SubscriptionChangeKind.Cancelled);
        }

        return new(Ended(s), true, null, null, SubscriptionChangeKind.Cancelled);
    }

    public static ScheduleChange WithdrawPending(ScheduleState s)
    {
        if (s.Status == SubscriptionStatus.Cancelled) throw Invalid(s.Status, "changed");
        if (s.PendingTerms is null && !s.PendingSkip && s.PendingStatusChange is null)
            throw new DomainRuleViolationException(BusinessViolationCodes.NoPendingChange, SubscriptionMessages.NoPendingChange, nameof(s.PendingTerms));

        return new(s with { PendingTerms = null, PendingSkip = false, PendingStatusChange = null }, true, null, null, SubscriptionChangeKind.Withdrawn);
    }

    /// <summary>§8.6 -- the cycle's order has been raised (or failed): pending terms become current, the next date moves on, a pending pause or cancel applies.
    /// A pending cancellation wins over a suspension.</summary>
    public static ScheduleState ProcessCycle(ScheduleState s, DateOnly cycleOn)
    {
        var terms = s.PendingTerms ?? s.Terms;
        var next = cycleOn.AddDays(7 * terms.IntervalWeeks);
        var skipped = s.LastSkippedOn;
        if (s.PendingSkip)
        {
            skipped = next;
            next = next.AddDays(7 * terms.IntervalWeeks);
        }

        var processed = s with { Terms = terms, PendingTerms = null, PendingSkip = false, LastCycleOn = cycleOn, LastSkippedOn = skipped, NextDeliveryOn = next };
        return s.PendingStatusChange == SubscriptionPendingStatusChange.Pause
            ? processed with { Status = SubscriptionStatus.Paused, NextDeliveryOn = null, NextDeliverySetOn = null, PendingStatusChange = null }
            : s.PendingStatusChange == SubscriptionPendingStatusChange.Cancel
                ? Ended(processed)
                : processed;
    }

    /// <summary>A first or restart date must lie in <c>[EarliestDeliveryOn, Today + MaxFirstDeliveryDays]</c>; with none given it is the earliest.</summary>
    public static DateOnly ValidFirstDate(DateOnly? requested, SubscriptionClock clock)
    {
        var date = requested ?? clock.EarliestDeliveryOn;
        if (date < clock.EarliestDeliveryOn || date > clock.Today.AddDays(SubscriptionRules.MaxFirstDeliveryDays))
            throw new DomainRuleViolationException(
                BusinessViolationCodes.InvalidFirstDeliveryDate,
                $"Choose a delivery date between {SubscriptionMessages.Day(clock.EarliestDeliveryOn)} and {SubscriptionMessages.Day(clock.Today.AddDays(SubscriptionRules.MaxFirstDeliveryDays))}.", "FirstDeliveryOn");

        return date;
    }

    // ── words ───────────────────────────────────────────────────────────────────────────────────

    /// <summary>The plain-language sentence a change answers with (US-SUB-02 AC2): it names the date the change takes effect, in the commerce zone.</summary>
    public static string Describe(ScheduleChange change, string productLabel)
    {
        var s = change.State;
        var from = change.AppliesFromCycleOn is { } f ? SubscriptionMessages.Day(f) : null;
        var locked = change.LockedCycleOn is { } l ? SubscriptionMessages.Day(l) : null;

        return (change.Kind, change.AppliedImmediately) switch
        {
            (SubscriptionChangeKind.TermsChanged, true) when s.NextDeliveryOn is { } next =>
                $"Done. Your next delivery on {SubscriptionMessages.Day(next)} will be {s.Terms.Quantity} × {productLabel}.",
            (SubscriptionChangeKind.TermsChanged, true) => "Done. Your changes are saved and apply when you resume.",
            (SubscriptionChangeKind.TermsChanged, false) =>
                $"Your delivery on {locked} is already being prepared, so this change starts with the delivery on {from}.",
            (SubscriptionChangeKind.Skipped, true) => $"Done. That delivery is skipped. Your next delivery is on {SubscriptionMessages.Day(s.NextDeliveryOn!.Value)}.",
            (SubscriptionChangeKind.Skipped, false) =>
                $"Your delivery on {locked} is already being prepared, so we will skip the one on {from} instead.",
            (SubscriptionChangeKind.Paused, true) => "Done. Your subscription is paused. Resume it any time.",
            (SubscriptionChangeKind.Paused, false) =>
                $"Your delivery on {locked} is already being prepared and will still arrive. Your subscription pauses after it, from {from}.",
            (SubscriptionChangeKind.Resumed, _) => $"Done. Your subscription is back on. Your next delivery is on {SubscriptionMessages.Day(s.NextDeliveryOn!.Value)}.",
            (SubscriptionChangeKind.Cancelled, true) => "Done. Your subscription is cancelled.",
            (SubscriptionChangeKind.Cancelled, false) =>
                $"Your delivery on {locked} is already being prepared and will still arrive. Your subscription ends after it.",
            _ => "Done. The scheduled change has been withdrawn.",
        };
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────

    private static ScheduleState Ended(ScheduleState s) =>
        s with { Status = SubscriptionStatus.Cancelled, NextDeliveryOn = null, NextDeliverySetOn = null, PendingTerms = null, PendingSkip = false, PendingStatusChange = null };

    private static DomainRuleViolationException NotSkippable(DateOnly requested, DateOnly? nextSkippable) =>
        new(BusinessViolationCodes.CycleNoLongerSkippable, SubscriptionMessages.CycleNoLongerSkippable(requested, nextSkippable), "CycleOn");

    private static DomainRuleViolationException Invalid(SubscriptionStatus status, string action) =>
        new(BusinessViolationCodes.InvalidSubscriptionTransition, SubscriptionMessages.TransitionNotAllowed(status, action), "Status");
}
