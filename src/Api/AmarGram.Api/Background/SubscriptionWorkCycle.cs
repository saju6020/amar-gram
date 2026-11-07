using AmarGram.Application.Commands.Notification;
using AmarGram.Application.Commands.Order;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Api.Background;

/// <summary>
/// HO-SUB-001 §12.2 (ADR-241, ADR-249) -- one pass of the subscription worker, three passes in a <b>fixed order</b>: (1) <b>unpaid</b> -- nominate subscriptions whose unpaid streak
/// reached the threshold and suspend them (the command re-checks); (2) <b>notices</b> -- the pre-charge notice, once per cycle, through <c>RequestNotificationCommand</c>;
/// (3) <b>generation</b> -- last, so a subscription suspended in pass 1 is never raised an order. Each pass takes at most <c>WorkerBatchSize</c> rows, oldest first.
/// <b>One scope per command</b> (ADR-241, F23): the request query, Ordering's placement and the cycle record each run in their own scope, never nested, so one save never commits
/// another's half-built entities. Recovery from a crash between placement and record is simply re-running the pass: the cycle's idempotency key returns the original order
/// and <c>ix_subscription_cycle_per_date</c> keeps one cycle row. An exception while placing is an exception, not a refusal: it is logged with ids, nothing is recorded, and the
/// next pass retries (§20.7). A pass that throws is logged and the next still runs (U-X4).
/// </summary>
public sealed class SubscriptionWorkCycle(ILogger<SubscriptionWorkCycle> logger, IServiceScopeFactory scopeFactory)
{
    private static UserContext WorkerContext => new(SystemActors.SubscriptionWorker, Guid.Empty) { UserName = "subscription-worker" };

    /// <summary>One pass. <paramref name="onlyCustomerId"/> (tests only) restricts every pass to one customer, so a test's clock never touches another test's subscriptions in a shared database.</summary>
    public async Task RunAsync(CancellationToken ct = default, Guid? onlyCustomerId = null)
    {
        await RunPassAsync("unpaid", token => SuspendUnpaidAsync(onlyCustomerId, token), ct);
        await RunPassAsync("notices", token => SendNoticesAsync(onlyCustomerId, token), ct);
        await RunPassAsync("generation", token => GenerateOrdersAsync(onlyCustomerId, token), ct);
    }

    // ── pass 1: unpaid ──────────────────────────────────────────────────────────────────────────

    public async Task SuspendUnpaidAsync(Guid? onlyCustomerId = null, CancellationToken ct = default)
    {
        IReadOnlyList<Guid> ids;
        using (var scope = scopeFactory.CreateScope())
        {
            var threshold = scope.ServiceProvider.GetRequiredService<IBusinessSettings>().GetInt(SettingKeys.SubscriptionMaxConsecutiveUnpaidCycles);
            ids = (await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().GetResultAsync(new GetUnpaidSuspensionCandidatesQuery
            { Threshold = threshold, Take = SubscriptionRules.WorkerBatchSize, CustomerId = onlyCustomerId, UserContext = WorkerContext, CorrelationId = Guid.NewGuid() })).Result ?? [];
        }

        foreach (var id in ids)
        {
            await DispatchAsync(
                new SuspendSubscriptionCommand
                { SubscriptionId = id, Reason = SubscriptionSuspensionReason.UnpaidCycles, UserContext = WorkerContext, CorrelationId = Guid.NewGuid(), ValidateCommand = true },
                $"suspension of subscription {id}", ct);
        }
    }

    // ── pass 2: notices ─────────────────────────────────────────────────────────────────────────

    public async Task SendNoticesAsync(Guid? onlyCustomerId = null, CancellationToken ct = default)
    {
        IReadOnlyList<PreChargeNoticeCandidate> candidates;
        using (var scope = scopeFactory.CreateScope())
        {
            candidates = (await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().GetResultAsync(new GetPreChargeNoticeCandidatesQuery
            { Take = SubscriptionRules.WorkerBatchSize, CustomerId = onlyCustomerId, UserContext = WorkerContext, CorrelationId = Guid.NewGuid() })).Result ?? [];
        }

        foreach (var c in candidates)
        {
            if (ct.IsCancellationRequested) return;

            try
            {
                using var scope = scopeFactory.CreateScope();
                var sp = scope.ServiceProvider;
                var clock = await sp.GetRequiredService<ICommerceClock>().GetAsync(ct);
                var links = sp.GetRequiredService<INotificationLinkBuilder>();

                var response = await sp.GetRequiredService<IInMemoryDispatcher>().SendAsync(new RequestNotificationCommand
                {
                    RequestId = Guid.NewGuid(),
                    TemplateKey = NotificationTemplateCatalogue.SubscriptionPreCharge,
                    RecipientKind = NotificationRecipientKind.Customer.DisplayName,
                    RecipientId = c.CustomerId,
                    Variables = new Dictionary<string, string>
                    {
                        ["productName"] = c.ProductName,
                        ["quantity"] = c.Quantity.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        ["deliveryOn"] = SubscriptionMessages.Day(c.CycleOn),
                        ["paymentMethodText"] = c.PaymentMethod,
                        ["estimatedAmount"] = c.EstimatedAmount,
                        ["skipLink"] = links.SubscriptionSkipLink(c.SubscriptionId, c.CycleOn),
                        ["manageLink"] = links.SubscriptionLink(c.SubscriptionId),
                    },
                    SubjectKind = NotificationSubjectKind.SubscriptionCycleDue.DisplayName,
                    SubjectId = c.SubscriptionId,
                    SubjectDueOn = c.CycleOn,
                    BranchId = AdministrationSeed.MainBranchId,
                    DeduplicationKey = SubscriptionKeys.NoticeDeduplicationKey(c.SubscriptionId, c.CycleOn),
                    NotAfter = clock.CutoffInstant(c.CycleOn),
                    UserContext = WorkerContext,
                    CorrelationId = Guid.NewGuid(),
                    ValidateCommand = true,
                });

                if (!response.IsSuccess) logger.LogWarning("Subscription worker: the notice for subscription {SubscriptionId} on {CycleOn} was refused.", c.SubscriptionId, c.CycleOn);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Subscription worker failed to request the notice for subscription {SubscriptionId} on {CycleOn}.", c.SubscriptionId, c.CycleOn);
            }
        }
    }

    // ── pass 3: generation ──────────────────────────────────────────────────────────────────────

    public async Task GenerateOrdersAsync(Guid? onlyCustomerId = null, CancellationToken ct = default)
    {
        IReadOnlyList<DueSubscriptionCycle> due;
        using (var scope = scopeFactory.CreateScope())
        {
            due = (await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().GetResultAsync(new GetDueSubscriptionCyclesQuery
            { Take = SubscriptionRules.WorkerBatchSize, CustomerId = onlyCustomerId, UserContext = WorkerContext, CorrelationId = Guid.NewGuid() })).Result ?? [];
        }

        foreach (var cycle in due)
        {
            if (ct.IsCancellationRequested) return;
            await GenerateOneAsync(cycle, ct);
        }
    }

    /// <summary>Scope 1 builds the request; scope 2 places the order; scope 3 records the cycle. Never throws: a failure is logged with ids and the next pass retries.</summary>
    private async Task GenerateOneAsync(DueSubscriptionCycle cycle, CancellationToken ct)
    {
        try
        {
            SubscriptionOrderRequest? request;
            using (var scope = scopeFactory.CreateScope())
            {
                request = (await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().GetResultAsync(new GetSubscriptionOrderRequestQuery
                { SubscriptionId = cycle.SubscriptionId, CycleOn = cycle.CycleOn, UserContext = WorkerContext, CorrelationId = Guid.NewGuid() })).Result;
            }

            if (request is null) return; // changed since the pass queried it

            CommandResponse placed;
            using (var scope = scopeFactory.CreateScope())
            {
                placed = await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().SendAsync(new PlaceSubscriptionOrderCommand
                {
                    OrderId = Guid.NewGuid(), SubscriptionId = request.SubscriptionId, CustomerId = request.CustomerId, SkuId = request.SkuId, CycleOn = request.CycleOn,
                    Quantity = request.Quantity, Fulfilment = request.Fulfilment, DeliveryAddressId = request.DeliveryAddressId, PickupBranchId = request.PickupBranchId,
                    PaymentMethod = request.PaymentMethod, DiscountPercent = request.DiscountPercent, UserContext = WorkerContext, CorrelationId = Guid.NewGuid(), ValidateCommand = true,
                });
            }

            var record = new RecordSubscriptionCycleCommand
            {
                SubscriptionCycleId = Guid.NewGuid(), SubscriptionId = request.SubscriptionId, CycleOn = request.CycleOn, IdempotencyKey = request.IdempotencyKey,
                DiscountPercent = request.DiscountPercent, UserContext = WorkerContext, CorrelationId = Guid.NewGuid(), ValidateCommand = true,
            };

            if (placed.IsSuccess && placed.Result is PlaceOrderResult order)
            {
                record = new RecordSubscriptionCycleCommand
                {
                    SubscriptionCycleId = record.SubscriptionCycleId, SubscriptionId = record.SubscriptionId, CycleOn = record.CycleOn, IdempotencyKey = record.IdempotencyKey,
                    DiscountPercent = record.DiscountPercent, UserContext = WorkerContext, CorrelationId = record.CorrelationId, ValidateCommand = true,
                    OrderId = order.OrderId, OrderNumber = order.OrderNumber, OrderStatus = order.Status, PaymentExpiresOn = order.PaymentDueBy, OrderTotal = order.GrandTotal,
                    CurrencyCode = order.CurrencyCode,
                };
            }
            else if (!placed.IsSuccess)
            {
                // A refusal (a business outcome): the cycle is consumed and the raw code kept for support. Orders' unknown codes are OrderRefused.
                record = new RecordSubscriptionCycleCommand
                {
                    SubscriptionCycleId = record.SubscriptionCycleId, SubscriptionId = record.SubscriptionId, CycleOn = record.CycleOn, IdempotencyKey = record.IdempotencyKey,
                    DiscountPercent = record.DiscountPercent, UserContext = WorkerContext, CorrelationId = record.CorrelationId, ValidateCommand = true,
                    FailureCode = placed.ValidationResult?.Errors.FirstOrDefault()?.ErrorCode ?? "OrderRefused",
                };
            }
            else
            {
                logger.LogError("Subscription worker: placing the order for subscription {SubscriptionId} on {CycleOn} returned no result; nothing recorded.", cycle.SubscriptionId, cycle.CycleOn);
                return;
            }

            using var recordScope = scopeFactory.CreateScope();
            var recorded = await recordScope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().SendAsync(record);
            if (!recorded.IsSuccess) logger.LogWarning("Subscription worker: recording the cycle for subscription {SubscriptionId} on {CycleOn} was refused.", cycle.SubscriptionId, cycle.CycleOn);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Graceful shutdown, not a per-item failure.
        }
        catch (Exception ex)
        {
            // An exception is not a refusal (§8.12): nothing is recorded, so the next pass retries under the same idempotency key.
            logger.LogError(ex, "Subscription worker failed for subscription {SubscriptionId} on {CycleOn}; it will be retried.", cycle.SubscriptionId, cycle.CycleOn);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────

    private async Task RunPassAsync(string name, Func<CancellationToken, Task> pass, CancellationToken ct)
    {
        try { await pass(ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { logger.LogError(ex, "Subscription worker {Pass} pass failed; the next pass still runs.", name); }
    }

    private async Task DispatchAsync(Command command, string what, CancellationToken ct)
    {
        if (ct.IsCancellationRequested) return;

        using var scope = scopeFactory.CreateScope();
        try
        {
            var response = await scope.ServiceProvider.GetRequiredService<IInMemoryDispatcher>().SendAsync(command);
            if (!response.IsSuccess) logger.LogWarning("Subscription worker: {What} was refused.", what);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Graceful shutdown, not a per-item failure.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Subscription worker failed for {What}.", what);
        }
    }
}
