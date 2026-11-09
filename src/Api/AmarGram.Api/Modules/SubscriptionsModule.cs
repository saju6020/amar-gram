// Subscriptions module -- HO-SUB-001 (recurring orders: US-SUB-01 to US-SUB-06), adapted for the organic shop (HO-P1, HO-P2).
//
// Program.cs already calls AddSubscriptionsModule(builder.Configuration) once (ADR-341/ADR-342); this file is the only one that changes. Registered explicitly -- there is
// no assembly scanning: every command handler, validator (as IValidator<T>, never the base class), query handler and domain event handler, the Infrastructure ports, the two
// notification guards (picked up by HO-NTF-001's SubjectGuardResolver through IEnumerable<INotificationSubjectGuard>) and the SubscriptionWorker.
//
// Not registered here, deliberately: IDispatcher / ICommandSender / IQueryProcessor / IValidationService (AddInMemoryBusServices() provides them), and anything gateway-shaped --
// there is no payment token, card or charge step in v1 (ADR-238).

using AmarGram.Api.Background;
using AmarGram.Application.CommandHandlers.Subscription;
using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Application.DomainEventHandlers.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Events.Order;
using AmarGram.Infrastructure.Configuration;
using AmarGram.Infrastructure.Notifications.Guards;
using AmarGram.Infrastructure.Subscriptions;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.QueryHandlers.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Domain.Models;
using FluentValidation;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Events;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Api.Modules;

public static class SubscriptionsModule
{
    public static IServiceCollection AddSubscriptionsModule(this IServiceCollection services, IConfiguration configuration)
    {
        // ── Ports (Infrastructure) ──
        services.AddScoped<ICommerceClock, CommerceClock>();
        services.AddScoped<ISubscribableCatalogue, SubscribableCatalogue>();
        services.AddScoped<ISubscriptionFinder, SubscriptionFinder>();
        services.AddScoped<ISubscriptionCycleStore, EfSubscriptionCycleStore>();
        services.AddScoped<SubscriptionViews>();

        // ── Notification subject guards (HO-NTF-001 §8.7): read-only, resolved by SubjectGuardResolver ──
        services.AddScoped<INotificationSubjectGuard, SubscriptionCycleDueGuard>();
        services.AddScoped<INotificationSubjectGuard, SubscriptionPaymentDueGuard>();

        // ── The subscription worker (§12.2): options bound from "Subscriptions", one scoped work cycle, one hosted service. ──
        services.AddOptions<SubscriptionsOptions>()
            .BindConfiguration(SubscriptionsOptions.SectionName)
            .Validate(o => o.Worker.IntervalSeconds >= 1, "Subscriptions:Worker:IntervalSeconds must be at least 1.")
            .ValidateOnStart();
        services.AddScoped<SubscriptionWorkCycle>();
        services.AddHostedService<SubscriptionWorker>();

        RegisterCommands(services);
        RegisterEventHandlers(services);
        RegisterQueries(services);

        return services;
    }

    private static void RegisterCommands(IServiceCollection services)
    {
        // ── Customer: subscribe and control (C1-C7) ──
        services.AddScoped<ICommandHandlerAsync<CreateSubscriptionCommand>, CreateSubscriptionCommandHandler>();
        services.AddScoped<IValidator<CreateSubscriptionCommand>, CreateSubscriptionCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<ChangeSubscriptionTermsCommand>, ChangeSubscriptionTermsCommandHandler>();
        services.AddScoped<IValidator<ChangeSubscriptionTermsCommand>, ChangeSubscriptionTermsCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<SkipSubscriptionDeliveryCommand>, SkipSubscriptionDeliveryCommandHandler>();
        services.AddScoped<IValidator<SkipSubscriptionDeliveryCommand>, SkipSubscriptionDeliveryCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<PauseSubscriptionCommand>, PauseSubscriptionCommandHandler>();
        services.AddScoped<IValidator<PauseSubscriptionCommand>, PauseSubscriptionCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<ResumeSubscriptionCommand>, ResumeSubscriptionCommandHandler>();
        services.AddScoped<IValidator<ResumeSubscriptionCommand>, ResumeSubscriptionCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<CancelSubscriptionCommand>, CancelSubscriptionCommandHandler>();
        services.AddScoped<IValidator<CancelSubscriptionCommand>, CancelSubscriptionCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<WithdrawPendingSubscriptionChangesCommand>, WithdrawPendingSubscriptionChangesCommandHandler>();
        services.AddScoped<IValidator<WithdrawPendingSubscriptionChangesCommand>, WithdrawPendingSubscriptionChangesCommandValidator>();

        // ── Staff: reinstate (C11) ──
        services.AddScoped<ICommandHandlerAsync<ReinstateSubscriptionCommand>, ReinstateSubscriptionCommandHandler>();
        services.AddScoped<IValidator<ReinstateSubscriptionCommand>, ReinstateSubscriptionCommandValidator>();

        // ── Sent by SubscriptionWorker only; no controller dispatches them (C8, C9, and the order placement) ──
        services.AddScoped<ICommandHandlerAsync<RecordSubscriptionCycleCommand>, RecordSubscriptionCycleCommandHandler>();
        services.AddScoped<IValidator<RecordSubscriptionCycleCommand>, RecordSubscriptionCycleCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<SuspendSubscriptionCommand>, SuspendSubscriptionCommandHandler>();
        services.AddScoped<IValidator<SuspendSubscriptionCommand>, SuspendSubscriptionCommandValidator>();

        services.AddScoped<ICommandHandlerAsync<PlaceSubscriptionOrderCommand>, PlaceSubscriptionOrderCommandHandler>();
        services.AddScoped<IValidator<PlaceSubscriptionOrderCommand>, PlaceSubscriptionOrderCommandValidator>();
    }

    private static void RegisterEventHandlers(IServiceCollection services)
    {
        // ADR-243: mirror Orders' outcomes onto the cycle. Idempotent; never enqueues a message (HO-NTF-001 ADR-057); never touches the subscription.
        services.AddScoped<IEventHandlerAsync<OrderConfirmedEvent>, MirrorOrderOutcomeToSubscriptionCycleHandler>();
        services.AddScoped<IEventHandlerAsync<OrderCancelledEvent>, MirrorOrderOutcomeToSubscriptionCycleHandler>();
        services.AddScoped<IEventHandlerAsync<OrderDeliveredEvent>, MirrorOrderOutcomeToSubscriptionCycleHandler>();
        services.AddScoped<IEventHandlerAsync<OrderDeliveryFailedEvent>, MirrorOrderOutcomeToSubscriptionCycleHandler>();

        // ADR-247 (HO-ACC-001 ADR-039): a merge moves subscriptions and cycles to the survivor; account deletion cancels. Neither enqueues a message.
        services.AddScoped<IEventHandlerAsync<CustomerMergedEvent>, ReassignSubscriptionsOnCustomerMergedHandler>();
        services.AddScoped<IEventHandlerAsync<CustomerAccountAnonymisedEvent>, CancelSubscriptionsOnAccountDeletedHandler>();
    }

    private static void RegisterQueries(IServiceCollection services)
    {
        // ── Customer ──
        services.AddScoped<IQueryHandlerAsync<GetCustomerSubscriptionsQuery, PagedResult<SubscriptionViewModel>>, GetCustomerSubscriptionsQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetCustomerSubscriptionDetailQuery, CustomerSubscriptionDetailViewModel?>, GetCustomerSubscriptionDetailQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetSubscriptionCyclesQuery, PagedResult<SubscriptionCycleViewModel>?>, GetSubscriptionCyclesQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetSubscriptionOptionsQuery, SubscriptionOptionsViewModel?>, GetSubscriptionOptionsQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetSubscriptionPaymentMethodsQuery, IReadOnlyList<SubscriptionPaymentMethodViewModel>?>, GetSubscriptionPaymentMethodsQueryHandler>();

        // ── Staff ──
        services.AddScoped<IQueryHandlerAsync<GetStaffSubscriptionsQuery, PagedResult<StaffSubscriptionRowViewModel>>, GetStaffSubscriptionsQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetUnpaidSubscriptionsQuery, PagedResult<UnpaidSubscriptionViewModel>>, GetUnpaidSubscriptionsQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetStaffSubscriptionDetailQuery, StaffSubscriptionDetailViewModel?>, GetStaffSubscriptionDetailQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetCustomerSubscriptionSummaryQuery, CustomerSubscriptionSummaryViewModel>, GetCustomerSubscriptionSummaryQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<ExportSubscriptionsQuery, IReadOnlyList<StaffSubscriptionRowViewModel>>, ExportSubscriptionsQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetSubscriptionDueTomorrowQuery, SubscriptionDueTomorrowViewModel>, GetSubscriptionDueTomorrowQueryHandler>();

        // ── Worker ──
        services.AddScoped<IQueryHandlerAsync<GetUnpaidSuspensionCandidatesQuery, IReadOnlyList<Guid>>, GetUnpaidSuspensionCandidatesQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetPreChargeNoticeCandidatesQuery, IReadOnlyList<PreChargeNoticeCandidate>>, GetPreChargeNoticeCandidatesQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetDueSubscriptionCyclesQuery, IReadOnlyList<DueSubscriptionCycle>>, GetDueSubscriptionCyclesQueryHandler>();
        services.AddScoped<IQueryHandlerAsync<GetSubscriptionOrderRequestQuery, SubscriptionOrderRequest?>, GetSubscriptionOrderRequestQueryHandler>();
    }
}
