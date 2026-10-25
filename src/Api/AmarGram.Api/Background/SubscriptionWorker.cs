using AmarGram.Infrastructure.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AmarGram.Api.Background;

/// <summary>
/// HO-SUB-001 §12.2, ADR-249 -- the same shape and rules as HO-ORD-001's <c>OrderWorker</c> and HO-NTF-001's <c>NotificationWorker</c>: a scope per poll,
/// <b>never throws out of <c>ExecuteAsync</c></b>, disabled in <c>Testing</c> (<c>Subscriptions:Worker:Enabled=false</c>); tests call <see cref="SubscriptionWorkCycle"/>
/// directly. One <c>BackgroundService</c> in the single host (ADR-010) -- NFR-PRF-7's "separate worker" is a separate background loop, bounded per pass.
/// </summary>
public sealed class SubscriptionWorker(IServiceScopeFactory scopeFactory, IOptions<SubscriptionsOptions> options, ILogger<SubscriptionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var worker = options.Value.Worker;
        if (!worker.Enabled)
        {
            logger.LogInformation("SubscriptionWorker is disabled (Subscriptions:Worker:Enabled=false).");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<SubscriptionWorkCycle>().RunAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "SubscriptionWorker pass failed; will retry on the next poll.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, worker.IntervalSeconds)), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Shutting down.
            }
        }
    }
}
