using System.Reflection;
using System.Text.RegularExpressions;
using AmarGram.Api.Background;
using AmarGram.Api.Contracts.Subscription;
using AmarGram.Api.Filters;
using AmarGram.Infrastructure.Configuration;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Platform.Infrastructure.Core.Validation;
using Xunit;

namespace AmarGram.IntegrationTests.Unit;

/// <summary>HO-SUB-001 section 15 U-X2 and U-X4, section 12.5 -- no host, no database.</summary>
public sealed class SubscriptionUnitTests
{
    // ── U-X4: a pass that throws is logged and the next pass still runs ──────────────────────────

    private sealed class ThrowingScopeFactory : IServiceScopeFactory
    {
        public int Scopes;

        public IServiceScope CreateScope()
        {
            Interlocked.Increment(ref Scopes);
            return new Scope();
        }

        // GetService returns null, so every GetRequiredService throws InvalidOperationException: a pass that fails.
        private sealed class Scope : IServiceScope, IServiceProvider
        {
            public IServiceProvider ServiceProvider => this;
            public object? GetService(Type serviceType) => null;
            public void Dispose() { }
        }
    }

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            lock (Entries) Entries.Add((logLevel, formatter(state, exception)));
        }
    }

    [Fact]
    public async Task U_X4_AWorkCycle_RunsAllThreePassesInOrder_EvenWhenEachOneThrows_AndNeverThrowsItself()
    {
        var logger = new RecordingLogger<SubscriptionWorkCycle>();
        var cycle = new SubscriptionWorkCycle(logger, new ThrowingScopeFactory());

        await cycle.RunAsync();   // must not throw

        var failed = logger.Entries.Where(e => e.Level == LogLevel.Error).Select(e => e.Message).ToList();
        Assert.Equal(3, failed.Count);
        Assert.Contains("unpaid", failed[0]);        // 1 unpaid -> 2 notices -> 3 generation: generation last, so a subscription suspended in pass 1 is never raised an order
        Assert.Contains("notices", failed[1]);
        Assert.Contains("generation", failed[2]);
    }

    [Fact]
    public async Task U_X4_TheWorker_LogsAFailedPass_KeepsLooping_AndExecuteAsyncNeverThrows()
    {
        var scopes = new ThrowingScopeFactory();
        var logger = new RecordingLogger<SubscriptionWorker>();
        var options = Options.Create(new SubscriptionsOptions { Worker = new SubscriptionsWorkerOptions { Enabled = true, IntervalSeconds = 1 } });
        var worker = new SubscriptionWorker(scopes, options, logger);

        await worker.StartAsync(CancellationToken.None);
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (Volatile.Read(ref scopes.Scopes) < 2 && DateTime.UtcNow < deadline) await Task.Delay(100);
        await worker.StopAsync(CancellationToken.None);

        Assert.True(scopes.Scopes >= 2, $"Only {scopes.Scopes} pass(es) ran.");
        Assert.False(worker.ExecuteTask?.IsFaulted ?? false);
        lock (logger.Entries) Assert.True(logger.Entries.Count(e => e.Level == LogLevel.Error) >= 2);
    }

    [Fact]
    public async Task ADisabledWorker_RunsNoPass()
    {
        var scopes = new ThrowingScopeFactory();
        var options = Options.Create(new SubscriptionsOptions { Worker = new SubscriptionsWorkerOptions { Enabled = false } });
        var worker = new SubscriptionWorker(scopes, options, new RecordingLogger<SubscriptionWorker>());

        await worker.StartAsync(CancellationToken.None);
        await Task.Delay(200);
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(0, scopes.Scopes);
    }

    // ── U-X2: nothing payment-shaped crosses the API ─────────────────────────────────────────────

    private static readonly Regex PaymentToken = new(@"card|token|\bpan\b|cvv|mandate|gateway|autoCharge", RegexOptions.IgnoreCase);

    [Fact]
    public void U_X2_NoRequestOrViewModel_CarriesAPaymentTokenCardOrGatewayMember_ADR238()
    {
        var contractTypes = typeof(CreateSubscriptionRequest).Assembly.GetTypes().Where(t => t.Namespace == typeof(CreateSubscriptionRequest).Namespace);
        var viewTypes = typeof(SubscriptionViewModel).Assembly.GetTypes().Where(t => t.Namespace == typeof(SubscriptionViewModel).Namespace && t.Name.Contains("Subscription", StringComparison.Ordinal));

        var offenders = contractTypes.Concat(viewTypes)
            .SelectMany(t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => $"{t.Name}.{p.Name}"))
            .Where(name => PaymentToken.IsMatch(name.Split('.')[1]))
            .ToList();

        Assert.True(offenders.Count == 0, "Payment-shaped members: " + string.Join(", ", offenders));
        Assert.NotEmpty(viewTypes);
    }

    // ── section 12.5: the double-subscribe race ──────────────────────────────────────────────────

    private static ExceptionContext Context(PostgresException pg) =>
        new(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()), new List<IFilterMetadata>())
        {
            Exception = new DbUpdateException("An error occurred while saving the entity changes.", pg),
        };

    [Fact]
    public void I_B4_TheLiveSubscriptionIndex_IsA400_SubscriptionAlreadyExists_NotA500()
    {
        var context = Context(new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "ix_subscription_live_per_sku", tableName: "subscription"));

        new UniqueConstraintExceptionFilter().OnException(context);

        Assert.True(context.ExceptionHandled);
        var result = Assert.IsType<BadRequestObjectResult>(context.Result);
        var validation = Assert.IsType<ValidationResponse>(result.Value);
        var error = Assert.Single(validation.Errors);
        Assert.Equal(BusinessViolationCodes.SubscriptionAlreadyExists, error.ErrorCode);
        Assert.Equal(SubscriptionMessages.SubscriptionAlreadyExists, error.ErrorMessage);
    }

    [Fact]
    public void TheCycleIndex_IsHandledInsideTheRecordHandler_ItNeverReachesTheFilter()
    {
        var context = Context(new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "ix_subscription_cycle_per_date", tableName: "subscription_cycle"));

        new UniqueConstraintExceptionFilter().OnException(context);

        Assert.False(context.ExceptionHandled);   // unknown to the filter: it rethrows rather than hiding it
    }
}
