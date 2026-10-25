using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Subscription;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Domain;

namespace AmarGram.Domain.Aggregates.Subscription;

/// <summary>
/// HO-SUB-001 §8.2 to §8.6 (US-SUB-01 to US-SUB-06, ADR-237 to ADR-243, ADR-247) -- a customer's standing instruction to receive a SKU every N weeks. The
/// subscription raises an <i>ordinary order</i> each cycle through Orders; it holds the order's <b>id</b> only on its cycles, never an order, stock or
/// money (ADR-241), and no payment token of any kind (ADR-238). All schedule arithmetic lives in <see cref="SubscriptionSchedule"/>, so the read side applies
/// the same rules; this class applies the result, records the event and bumps the version. One aggregate is mutated per command, with the one recorded
/// exception of recording a processed cycle (ADR-240).
///
/// Adapted for the organic shop (HO-P1, HO-P2): the cat, the prescription authorisation and the clinic reactions are gone; a product is subscribable when staff
/// mark it so. Every mutation ends <c>UpdateVersion()</c>; <c>xmin</c> turns a race into a <c>409</c> (ADR-016).
/// </summary>
public sealed class SubscriptionAggregate : AggregateRoot
{
    public Guid CustomerId { get; private set; }
    public Guid SkuId { get; private set; }
    public SubscribedProduct Product { get; private set; } = default!;
    public SubscriptionTerms Terms { get; private set; } = default!;

    /// <summary>Terms that take effect after the locked cycle (§8.5).</summary>
    public SubscriptionTerms? PendingTerms { get; private set; }

    /// <summary>Skip the cycle <i>after</i> the locked one.</summary>
    public bool PendingSkip { get; private set; }

    public SubscriptionPendingStatusChange? PendingStatusChange { get; private set; }
    public SubscriptionStatus Status { get; private set; } = SubscriptionStatus.Active;
    public SubscriptionSuspensionReason? SuspensionReason { get; private set; }
    public DateTimeOffset? SuspendedOn { get; private set; }

    /// <summary>The date the next cycle's order is raised (ADR-239). Set only while <c>Active</c>.</summary>
    public DateOnly? NextDeliveryOn { get; private set; }

    /// <summary>The local date <see cref="NextDeliveryOn"/> was last set <i>by a person</i>: suppresses a pre-charge notice they have just been shown (§8.8).</summary>
    public DateOnly? NextDeliverySetOn { get; private set; }

    public DateOnly StartedOn { get; private set; }
    public DateOnly? LastCycleOn { get; private set; }
    public DateOnly? LastSkippedOn { get; private set; }
    public DateTimeOffset? PausedOn { get; private set; }
    public DateTimeOffset? CancelledOn { get; private set; }
    public Guid? CancelledBy { get; private set; }
    public SubscriptionCancellationReason? CancellationReason { get; private set; }

    /// <summary>Free text (up to 500, plain). Never goes into an event or a log (§11.5).</summary>
    public string? CancellationNote { get; private set; }

    public DateTimeOffset? ReinstatedOn { get; private set; }
    public Guid? ReinstatedBy { get; private set; }
    public string? ReinstatementReason { get; private set; }

    private SubscriptionAggregate() { }

    public SubscriptionAggregate(Guid id) : base(id) { }

    public bool IsLive => Status != SubscriptionStatus.Cancelled;

    /// <summary>The schedule-relevant state, for the pure <see cref="SubscriptionSchedule"/> and the read side.</summary>
    public ScheduleState ToScheduleState() =>
        new(Status, Terms, PendingTerms, PendingSkip, PendingStatusChange, NextDeliveryOn, NextDeliverySetOn, LastCycleOn, LastSkippedOn);

    private string ProductLabel => string.IsNullOrWhiteSpace(Product.VariantLabel) ? Product.ProductName : $"{Product.ProductName} {Product.VariantLabel}";

    // ── create (US-SUB-01 AC1) ──────────────────────────────────────────────────────────────────

    public void Create(CreateSubscriptionDto dto)
    {
        var first = SubscriptionSchedule.ValidFirstDate(dto.FirstDeliveryOn, dto.Clock);

        CustomerId = dto.CustomerId;
        SkuId = dto.SkuId;
        Product = new SubscribedProduct(dto.ProductName, dto.VariantLabel);
        Terms = dto.Terms;
        Status = SubscriptionStatus.Active;
        StartedOn = first;
        NextDeliveryOn = first;
        NextDeliverySetOn = dto.Clock.Today;

        SetDefaultValue(dto.UserContext);
        AddDomainEvent(new SubscriptionCreatedEvent
        {
            SubscriptionId = Id, CustomerId = CustomerId, SkuId = SkuId, IntervalWeeks = Terms.IntervalWeeks, Quantity = Terms.Quantity,
            PaymentMethod = Terms.PaymentMethod.Value, NextDeliveryOn = first, CorrelationId = dto.CorrelationId, UserContext = dto.UserContext,
        });
        UpdateVersion();
    }

    // ── the customer's controls (US-SUB-02) ─────────────────────────────────────────────────────

    public SubscriptionChangeOutcome ChangeTerms(SubscriptionTerms terms, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        var change = SubscriptionSchedule.ChangeTerms(ToScheduleState(), terms, clock);
        Apply(change.State);

        AddDomainEvent(new SubscriptionTermsChangedEvent
        {
            SubscriptionId = Id, AppliedImmediately = change.AppliedImmediately, AppliesFromCycleOn = change.AppliesFromCycleOn, CorrelationId = correlationId, UserContext = user,
        });
        UpdateVersion();
        return Outcome(change);
    }

    public SubscriptionChangeOutcome SkipDelivery(DateOnly cycleOn, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        var change = SubscriptionSchedule.Skip(ToScheduleState(), cycleOn, clock);
        Apply(change.State);

        AddDomainEvent(new SubscriptionDeliverySkippedEvent
        {
            SubscriptionId = Id, CycleOn = cycleOn, AppliedImmediately = change.AppliedImmediately, CorrelationId = correlationId, UserContext = user,
        });
        UpdateVersion();
        return Outcome(change);
    }

    public SubscriptionChangeOutcome Pause(SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        var change = SubscriptionSchedule.Pause(ToScheduleState(), clock);
        Apply(change.State);

        if (change.AppliedImmediately)
        {
            PausedOn = clock.Now;
            AddDomainEvent(new SubscriptionPausedEvent { SubscriptionId = Id, CorrelationId = correlationId, UserContext = user });
        }
        else
        {
            AddDomainEvent(Scheduled(change, correlationId, user));
        }

        UpdateVersion();
        return Outcome(change);
    }

    public SubscriptionChangeOutcome Resume(DateOnly? firstDeliveryOn, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        var change = SubscriptionSchedule.Resume(ToScheduleState(), firstDeliveryOn, clock);
        Apply(change.State);
        PausedOn = null;

        AddDomainEvent(new SubscriptionResumedEvent
        {
            SubscriptionId = Id, Trigger = SubscriptionResumeTrigger.Customer.Value, NextDeliveryOn = NextDeliveryOn, CorrelationId = correlationId, UserContext = user,
        });
        UpdateVersion();
        return Outcome(change);
    }

    /// <summary>Customer or staff cancellation. A locked <c>Active</c> subscription ends <i>after</i> the order already being prepared (§8.5).</summary>
    public SubscriptionChangeOutcome Cancel(Guid by, SubscriptionCancellationReason reason, string? note, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        if (note is { Length: > SubscriptionRules.MaxNoteLength })
            throw new DomainRuleViolationException(BusinessViolationCodes.CancellationReasonRequired, $"A cancellation note is up to {SubscriptionRules.MaxNoteLength} characters.", nameof(note));

        var change = SubscriptionSchedule.Cancel(ToScheduleState(), clock);
        Apply(change.State);

        CancelledBy = by;
        CancellationReason = reason;
        CancellationNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (Status == SubscriptionStatus.Cancelled) CancelledOn = clock.Now;

        if (change.AppliedImmediately)
            AddDomainEvent(new SubscriptionCancelledEvent { SubscriptionId = Id, Reason = reason.Value, CorrelationId = correlationId, UserContext = user });
        else
            AddDomainEvent(Scheduled(change, correlationId, user));

        UpdateVersion();
        return Outcome(change);
    }

    public SubscriptionChangeOutcome WithdrawPendingChanges(SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        var change = SubscriptionSchedule.WithdrawPending(ToScheduleState());
        Apply(change.State);

        // A scheduled cancellation that is withdrawn also forgets the reason recorded when it was scheduled.
        if (Status != SubscriptionStatus.Cancelled && CancelledOn is null)
        {
            CancelledBy = null;
            CancellationReason = null;
            CancellationNote = null;
        }

        AddDomainEvent(new SubscriptionPendingChangesWithdrawnEvent { SubscriptionId = Id, CorrelationId = correlationId, UserContext = user });
        UpdateVersion();
        return Outcome(change);
    }

    // ── the worker (§8.6) ───────────────────────────────────────────────────────────────────────

    /// <summary>
    /// The cycle on <paramref name="cycleOn"/> has been processed (an order raised, or the attempt failed and the cycle consumed). Advances the schedule, applies
    /// pending changes and, for a failure that no retry would fix, suspends the subscription -- unless a pending cancellation ends it first.
    /// </summary>
    public void RecordCycleProcessed(
        DateOnly cycleOn, SubscriptionCycleOutcome outcome, SubscriptionCycleFailureReason? failure, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        if (Status != SubscriptionStatus.Active || NextDeliveryOn != cycleOn)
            throw new DomainRuleViolationException(BusinessViolationCodes.CycleNotDue, "This subscription has no delivery due on that date.", nameof(cycleOn));

        Apply(SubscriptionSchedule.ProcessCycle(ToScheduleState(), cycleOn));
        if (Status == SubscriptionStatus.Paused) PausedOn = clock.Now;
        if (Status == SubscriptionStatus.Cancelled) CancelledOn = clock.Now;

        AddDomainEvent(new SubscriptionCycleProcessedEvent
        {
            SubscriptionId = Id, CycleOn = cycleOn, Outcome = outcome.Value, CorrelationId = correlationId, UserContext = user,
        });

        if (outcome == SubscriptionCycleOutcome.Failed && failure is not null && Status == SubscriptionStatus.Active
            && SubscriptionFailureClassifier.SuspensionFor(failure) is { } suspension)
        {
            Suspend(suspension, clock.Now, user, correlationId);
        }
        else
        {
            UpdateVersion();
        }
    }

    // ── suspension and reinstatement (US-SUB-06) ────────────────────────────────────────────────

    /// <summary>Idempotent: an already-suspended subscription raises no event and does not change version (an event handler may call it twice).</summary>
    public bool Suspend(SubscriptionSuspensionReason reason, DateTimeOffset now, UserContext user, Guid correlationId)
    {
        if (Status == SubscriptionStatus.Suspended) return false;
        if (Status != SubscriptionStatus.Active && Status != SubscriptionStatus.Paused)
            throw new DomainRuleViolationException(BusinessViolationCodes.InvalidSubscriptionTransition, SubscriptionMessages.TransitionNotAllowed(Status, "suspended"), nameof(Status));

        Status = SubscriptionStatus.Suspended;
        SuspensionReason = reason;
        SuspendedOn = now;
        NextDeliveryOn = null;
        NextDeliverySetOn = null;
        PendingTerms = null;
        PendingSkip = false;
        PendingStatusChange = null;

        AddDomainEvent(new SubscriptionSuspendedEvent { SubscriptionId = Id, Reason = reason.Value, CorrelationId = correlationId, UserContext = user });
        UpdateVersion();
        return true;
    }

    /// <summary>Staff lift a suspension (OQ-6): the subscription restarts, with no re-creation.</summary>
    public void Reinstate(Guid by, string reason, DateOnly? firstDeliveryOn, SubscriptionClock clock, UserContext user, Guid correlationId)
    {
        if (Status != SubscriptionStatus.Suspended)
            throw new DomainRuleViolationException(BusinessViolationCodes.SubscriptionCannotBeReinstated, SubscriptionMessages.TransitionNotAllowed(Status, "reinstated"), nameof(Status));

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > SubscriptionRules.MaxNoteLength)
            throw new DomainRuleViolationException(BusinessViolationCodes.ReinstatementReasonRequired, SubscriptionMessages.ReinstatementReasonRequired, nameof(reason));

        var date = SubscriptionSchedule.ValidFirstDate(firstDeliveryOn, clock);
        Status = SubscriptionStatus.Active;
        SuspensionReason = null;
        SuspendedOn = null;
        NextDeliveryOn = date;
        NextDeliverySetOn = clock.Today;
        ReinstatedOn = clock.Now;
        ReinstatedBy = by;
        ReinstatementReason = reason.Trim();

        AddDomainEvent(new SubscriptionReinstatedEvent { SubscriptionId = Id, NextDeliveryOn = date, CorrelationId = correlationId, UserContext = user });
        UpdateVersion();
    }

    // ── customer data (HO-ACC-001 ADR-039, ADR-247) ─────────────────────────────────────────────

    /// <summary>The customer was merged into another: the subscription follows the survivor. Idempotent.</summary>
    public bool ReassignCustomerOnMerge(Guid survivingCustomerId, UserContext user, Guid correlationId)
    {
        if (CustomerId == survivingCustomerId) return false;

        var from = CustomerId;
        CustomerId = survivingCustomerId;
        AddDomainEvent(new SubscriptionCustomerReassignedEvent
        {
            SubscriptionId = Id, FromCustomerId = from, ToCustomerId = survivingCustomerId, CorrelationId = correlationId, UserContext = user,
        });
        UpdateVersion();
        return true;
    }

    /// <summary>The survivor already has a live subscription to this SKU: the duplicate's is cancelled (<c>CustomerMerged</c>). Idempotent.</summary>
    public bool CancelAsMergeDuplicate(DateTimeOffset now, UserContext user, Guid correlationId) =>
        CancelBySystem(SubscriptionCancellationReason.CustomerMerged, now, user, correlationId);

    /// <summary>The account was deleted (anonymised): every live subscription is cancelled and its free-text note cleared. Idempotent.</summary>
    public bool CancelOnAccountDeletion(DateTimeOffset now, UserContext user, Guid correlationId)
    {
        var cancelled = CancelBySystem(SubscriptionCancellationReason.AccountDeleted, now, user, correlationId);
        if (CancellationNote is not null)
        {
            CancellationNote = null;
            ReinstatementReason = null;
            if (!cancelled) UpdateVersion();
        }

        return cancelled;
    }

    private bool CancelBySystem(SubscriptionCancellationReason reason, DateTimeOffset now, UserContext user, Guid correlationId)
    {
        if (Status == SubscriptionStatus.Cancelled) return false;

        Apply(ToScheduleState() with
        {
            Status = SubscriptionStatus.Cancelled, NextDeliveryOn = null, NextDeliverySetOn = null, PendingTerms = null, PendingSkip = false, PendingStatusChange = null,
        });
        CancelledOn = now;
        CancelledBy = user.UserId;
        CancellationReason = reason;
        CancellationNote = null;

        AddDomainEvent(new SubscriptionCancelledEvent { SubscriptionId = Id, Reason = reason.Value, CorrelationId = correlationId, UserContext = user });
        UpdateVersion();
        return true;
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────

    private void Apply(ScheduleState s)
    {
        Status = s.Status;
        Terms = s.Terms;
        PendingTerms = s.PendingTerms;
        PendingSkip = s.PendingSkip;
        PendingStatusChange = s.PendingStatusChange;
        NextDeliveryOn = s.NextDeliveryOn;
        NextDeliverySetOn = s.NextDeliverySetOn;
        LastCycleOn = s.LastCycleOn;
        LastSkippedOn = s.LastSkippedOn;
    }

    private SubscriptionChangeOutcome Outcome(ScheduleChange change) =>
        new(change.AppliedImmediately, change.AppliesFromCycleOn, SubscriptionSchedule.Describe(change, ProductLabel));

    private SubscriptionChangeScheduledEvent Scheduled(ScheduleChange change, Guid correlationId, UserContext user) =>
        new() { SubscriptionId = Id, Kind = (int)change.Kind, AppliesFromCycleOn = change.AppliesFromCycleOn, CorrelationId = correlationId, UserContext = user };
}
