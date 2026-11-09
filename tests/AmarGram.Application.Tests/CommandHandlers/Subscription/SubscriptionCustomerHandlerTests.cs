using AmarGram.Application.CommandHandlers.Subscription;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Platform.Infrastructure.Core.Commands;
using static AmarGram.Application.Tests.TestSupport.SubscriptionWorld;

namespace AmarGram.Application.Tests.CommandHandlers.Subscription;

/// <summary>
/// HO-SUB-001 §11.4 C1 to C7 -- the customer handlers. They orchestrate: resolve the subscription by id <b>and</b> caller (someone else's is the same <c>SubscriptionNotFound</c>
/// as one that does not exist), call one mutation, enqueue the message, save -- and they <b>return</b> a violation, never throw one (ADR-014). The happy path of C1 (which asks
/// Orders' checkout quote) is covered end to end by the integration suite.
/// </summary>
public sealed class SubscriptionCustomerHandlerTests
{
    private static CreateSubscriptionCommand CreateCommand(SubscriptionWorld w, Guid? skuId = null, int quantity = 2, int interval = 4, Platform.Infrastructure.Common.Security.UserContext? user = null) => new()
    {
        SubscriptionId = Guid.NewGuid(), SkuId = skuId ?? w.SkuId, Quantity = quantity, IntervalWeeks = interval, Fulfilment = SubscriptionFulfilment.Delivery,
        DeliveryAddressId = w.AddressId, PaymentMethod = SubscriptionPaymentMethod.CashOnDelivery, UserContext = user ?? w.CustomerUser(), CorrelationId = Guid.NewGuid(),
    };

    // The create handler asks Orders' checkout loader only after every pre-check below has passed, so these refusals never reach it.
    private static CreateSubscriptionCommandHandler Create(SubscriptionWorld w) =>
        new(w.Subscriptions, w.Catalogue, w.Finder, null!, w.Clock, w.Settings, w.Outbox, w.Links);

    [Fact]
    public async Task C1_ASignedInStaffMember_IsNotACustomer_SubscriptionNotFound()
    {
        var w = new SubscriptionWorld();
        var response = await Create(w).HandleAsync(CreateCommand(w, user: w.StaffUser()));

        Assert.False(response.IsSuccess);
        Assert.Equal(BusinessViolationCodes.SubscriptionNotFound, Codes(response));
        Assert.Empty(w.Subscriptions.Saved);
    }

    [Fact]
    public async Task C1_AnUnknownSku_IsProductNotFound()
    {
        var w = new SubscriptionWorld();
        var response = await Create(w).HandleAsync(CreateCommand(w, skuId: Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.ProductNotFound, Codes(response));
    }

    [Fact]
    public async Task I_B3_ASkuThatCannotBeBoughtOrIsNotOffered_IsNotSubscribable_WithTheSpecificReason()
    {
        var w = new SubscriptionWorld();
        var archived = Guid.NewGuid();
        var notOffered = Guid.NewGuid();
        w.Catalogue.Add(archived, purchasable: false);
        w.Catalogue.Add(notOffered, subscribable: false);

        var inactive = await Create(w).HandleAsync(CreateCommand(w, skuId: archived));
        var staffOnly = await Create(w).HandleAsync(CreateCommand(w, skuId: notOffered));

        Assert.Equal(BusinessViolationCodes.SkuNotSubscribable, Codes(inactive));
        Assert.Equal(SubscriptionMessages.SkuNotSubscribableInactive, inactive.ValidationResult!.Errors.Single().ErrorMessage);
        Assert.Equal(BusinessViolationCodes.SkuNotSubscribable, Codes(staffOnly));
        Assert.Equal(SubscriptionMessages.SkuNotSubscribableNotOffered, staffOnly.ValidationResult!.Errors.Single().ErrorMessage);
        Assert.Empty(w.Subscriptions.Saved);
    }

    [Fact]
    public async Task I_B4_ALiveSubscriptionToTheSameSku_IsRefused()
    {
        var w = new SubscriptionWorld();
        w.AddActive();

        var duplicate = await Create(w).HandleAsync(CreateCommand(w));
        Assert.Equal(BusinessViolationCodes.SubscriptionAlreadyExists, Codes(duplicate));
    }

    [Fact]
    public async Task C1_TheLiveLimit_IsEnforced()
    {
        var w = new SubscriptionWorld();
        for (var i = 0; i < SubscriptionRules.MaxLiveSubscriptionsPerCustomer; i++) w.AddActive(skuId: Guid.NewGuid());

        var response = await Create(w).HandleAsync(CreateCommand(w));

        Assert.Equal(BusinessViolationCodes.SubscriptionLimitReached, Codes(response));
    }

    [Fact]
    public async Task C1_InvalidTerms_AreReturned_NotThrown()
    {
        var w = new SubscriptionWorld();

        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionQuantity, Codes(await Create(w).HandleAsync(CreateCommand(w, quantity: 21))));
        Assert.Equal(BusinessViolationCodes.InvalidSubscriptionInterval, Codes(await Create(w).HandleAsync(CreateCommand(w, interval: 3))));
    }

    // ── C2 to C7: control ────────────────────────────────────────────────────────────────────────

    private static SkipSubscriptionDeliveryCommandHandler Skip(SubscriptionWorld w) => new(w.Subscriptions, w.Clock, w.Outbox, w.Links);
    private static PauseSubscriptionCommandHandler Pause(SubscriptionWorld w) => new(w.Subscriptions, w.Clock, w.Outbox, w.Links);
    private static CancelSubscriptionCommandHandler Cancel(SubscriptionWorld w) => new(w.Subscriptions, w.Clock, w.Outbox, w.Links);
    private static ResumeSubscriptionCommandHandler Resume(SubscriptionWorld w) => new(w.Subscriptions, w.Catalogue, w.Clock, w.Settings, w.Outbox, w.Links);
    private static WithdrawPendingSubscriptionChangesCommandHandler Withdraw(SubscriptionWorld w) => new(w.Subscriptions, w.Clock, w.Outbox, w.Links);

    [Fact]
    public async Task I_B8_AnotherCustomersSubscription_IsNotFound_ForEveryCustomerCommand()
    {
        var w = new SubscriptionWorld();
        var theirs = w.AddActive(customerId: Guid.NewGuid());
        var me = w.CustomerUser();

        var responses = new[]
        {
            await Skip(w).HandleAsync(new SkipSubscriptionDeliveryCommand { SubscriptionId = theirs.Id, CycleOn = D(10, 4), UserContext = me, CorrelationId = Guid.NewGuid() }),
            await Pause(w).HandleAsync(new PauseSubscriptionCommand { SubscriptionId = theirs.Id, UserContext = me, CorrelationId = Guid.NewGuid() }),
            await Resume(w).HandleAsync(new ResumeSubscriptionCommand { SubscriptionId = theirs.Id, UserContext = me, CorrelationId = Guid.NewGuid() }),
            await Withdraw(w).HandleAsync(new WithdrawPendingSubscriptionChangesCommand { SubscriptionId = theirs.Id, UserContext = me, CorrelationId = Guid.NewGuid() }),
            await Cancel(w).HandleAsync(new CancelSubscriptionCommand
            { SubscriptionId = theirs.Id, Reason = SubscriptionCancellationReason.Other, UserContext = me, CorrelationId = Guid.NewGuid() }),
        };

        Assert.All(responses, r => Assert.Equal(BusinessViolationCodes.SubscriptionNotFound, Codes(r)));
        Assert.Equal(SubscriptionStatus.Active, theirs.Status);
        Assert.Empty(w.Subscriptions.Updated);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task I_C2_Skipping_BeforeTheCutoff_MovesTheDelivery_AndTellsTheCustomer()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();

        var response = await Skip(w).HandleAsync(new SkipSubscriptionDeliveryCommand { SubscriptionId = subscription.Id, CycleOn = D(10, 4), UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.True(response.IsSuccess);
        var outcome = Assert.IsType<SubscriptionChangeOutcome>(response.Result);
        Assert.True(outcome.AppliedImmediately);
        Assert.Equal(D(11, 1), subscription.NextDeliveryOn);
        Assert.Same(subscription, Assert.Single(w.Subscriptions.Updated));

        var message = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionChanged, message.TemplateKey);
        Assert.Equal(w.CustomerId, message.RecipientId);
        Assert.Equal(outcome.Message, message.Variables["changeMessage"]);
    }

    [Fact]
    public async Task I_C8_ASkipWithAStaleDate_IsReturnedAsCycleNoLongerSkippable_NothingIsSaved()
    {
        var w = new SubscriptionWorld(Oct1Locked);
        var subscription = w.AddActive();

        var response = await Skip(w).HandleAsync(new SkipSubscriptionDeliveryCommand { SubscriptionId = subscription.Id, CycleOn = D(10, 4), UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.False(response.IsSuccess);
        Assert.Equal(BusinessViolationCodes.CycleNoLongerSkippable, Codes(response));
        Assert.Contains("Sun 1 Nov", response.ValidationResult!.Errors.Single().ErrorMessage);
        Assert.Empty(w.Subscriptions.Updated);
        Assert.Empty(w.Outbox.Requests);
    }

    [Fact]
    public async Task I_C6_AfterTheCutoff_Pausing_IsScheduled_AndTheMessageNamesBothDates()
    {
        var w = new SubscriptionWorld(Oct1Locked);
        var subscription = w.AddActive();

        var response = await Pause(w).HandleAsync(new PauseSubscriptionCommand { SubscriptionId = subscription.Id, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        var outcome = Assert.IsType<SubscriptionChangeOutcome>(response.Result);
        Assert.False(outcome.AppliedImmediately);
        Assert.Equal(D(11, 1), outcome.AppliesFromCycleOn);
        Assert.Contains("Sun 4 Oct", outcome.Message);
        Assert.Contains("Sun 1 Nov", outcome.Message);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
    }

    [Fact]
    public async Task I_C4_Cancelling_RecordsTheReason_AndEnqueuesTheUrgentCancelledMessage()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();

        var response = await Cancel(w).HandleAsync(new CancelSubscriptionCommand
        { SubscriptionId = subscription.Id, Reason = SubscriptionCancellationReason.TooExpensive, Note = "too dear", UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.True(response.IsSuccess);
        Assert.Equal(SubscriptionStatus.Cancelled, subscription.Status);
        Assert.Equal(SubscriptionCancellationReason.TooExpensive, subscription.CancellationReason);
        var message = Assert.Single(w.Outbox.Requests);
        Assert.Equal(NotificationTemplateCatalogue.SubscriptionCancelled, message.TemplateKey);
        Assert.Equal("now", message.Variables["endsText"]);
    }

    [Fact]
    public async Task I_C7_Cancelling_AfterTheCutoff_SaysWhenItEnds()
    {
        var w = new SubscriptionWorld(Oct1Locked);
        var subscription = w.AddActive();

        await Cancel(w).HandleAsync(new CancelSubscriptionCommand
        { SubscriptionId = subscription.Id, Reason = SubscriptionCancellationReason.NoLongerNeeded, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.Equal(SubscriptionStatus.Active, subscription.Status);   // the locked order still goes
        Assert.Equal("after your delivery on Sun 4 Oct", Assert.Single(w.Outbox.Requests).Variables["endsText"]);
    }

    [Fact]
    public async Task C6_StaffCancelAnyCustomersSubscription_ByStaff()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive(customerId: Guid.NewGuid());
        var staff = w.StaffUser();

        var response = await Cancel(w).HandleAsync(new CancelSubscriptionCommand
        { SubscriptionId = subscription.Id, Reason = SubscriptionCancellationReason.StaffCancelled, Note = "Customer rang", ByStaff = true, UserContext = staff, CorrelationId = Guid.NewGuid() });

        Assert.True(response.IsSuccess);
        Assert.Equal(SubscriptionStatus.Cancelled, subscription.Status);
        Assert.Equal(staff.UserId, subscription.CancelledBy);
        Assert.Equal(subscription.CustomerId, Assert.Single(w.Outbox.Requests).RecipientId);   // it is the customer who is told
    }

    [Fact]
    public async Task I_F6_ACustomerCannotResumeASuspension_ThePauseStaysAPauseAndIsResumable()
    {
        var w = new SubscriptionWorld();
        var suspended = w.AddActive();
        suspended.Suspend(SubscriptionSuspensionReason.UnpaidCycles, Oct1, w.StaffUser(), Guid.NewGuid());

        var refused = await Resume(w).HandleAsync(new ResumeSubscriptionCommand { SubscriptionId = suspended.Id, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });
        Assert.Equal(BusinessViolationCodes.SubscriptionSuspended, Codes(refused));
        Assert.Contains("2 unpaid orders", refused.ValidationResult!.Errors.Single().ErrorMessage);
        Assert.Equal(SubscriptionStatus.Suspended, suspended.Status);

        var paused = w.AddActive(skuId: Guid.NewGuid());
        w.Catalogue.Add(paused.SkuId);
        paused.Pause(w.ClockAt(w.Now), w.StaffUser(), Guid.NewGuid());
        var resumed = await Resume(w).HandleAsync(new ResumeSubscriptionCommand { SubscriptionId = paused.Id, UserContext = w.CustomerUser(paused.CustomerId), CorrelationId = Guid.NewGuid() });
        Assert.True(resumed.IsSuccess);
        Assert.Equal(SubscriptionStatus.Active, paused.Status);
    }

    [Fact]
    public async Task C5_ResumingAProductThatCanNoLongerBeBought_IsRefusedNow_NotAtTheNextCycle()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();
        subscription.Pause(w.ClockAt(w.Now), w.StaffUser(), Guid.NewGuid());
        w.Catalogue.Add(w.SkuId, purchasable: false);

        var response = await Resume(w).HandleAsync(new ResumeSubscriptionCommand { SubscriptionId = subscription.Id, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.Equal(BusinessViolationCodes.SkuNotSubscribable, Codes(response));
        Assert.Equal(SubscriptionStatus.Paused, subscription.Status);
    }

    [Fact]
    public async Task I_C9_WithdrawingWhenNothingIsPending_IsNoPendingChange()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();

        var response = await Withdraw(w).HandleAsync(new WithdrawPendingSubscriptionChangesCommand { SubscriptionId = subscription.Id, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid() });

        Assert.Equal(BusinessViolationCodes.NoPendingChange, Codes(response));
    }

    [Fact]
    public async Task C2_ChangingTerms_WithAStaleVersion_IsStaleVersion_BeforeAnythingElseIsAsked()
    {
        var w = new SubscriptionWorld();
        var subscription = w.AddActive();
        var handler = new ChangeSubscriptionTermsCommandHandler(w.Subscriptions, null!, w.Clock, w.Settings, w.Outbox, w.Links);

        var response = await handler.HandleAsync(new ChangeSubscriptionTermsCommand
        {
            SubscriptionId = subscription.Id, ExpectedVersion = subscription.Version + 1, Quantity = 3, IntervalWeeks = 4, Fulfilment = SubscriptionFulfilment.Delivery,
            DeliveryAddressId = w.AddressId, PaymentMethod = SubscriptionPaymentMethod.CashOnDelivery, UserContext = w.CustomerUser(), CorrelationId = Guid.NewGuid(),
        });

        Assert.Equal(BusinessViolationCodes.StaleVersion, Codes(response));
        Assert.Empty(w.Subscriptions.Updated);
    }
}
