namespace AmarGram.Infrastructure.Configuration;

/// <summary>HO-SUB-001 §12.2 (ADR-249). Bound from configuration section "Subscriptions": the worker that suspends unpaid subscriptions, sends the pre-charge notices and
/// raises each cycle's order. Disabled in the <c>Testing</c> environment (<c>Subscriptions:Worker:Enabled=false</c>); tests call <c>SubscriptionWorkCycle</c> directly.
/// The default interval is 900 seconds.</summary>
public sealed class SubscriptionsOptions
{
    public const string SectionName = "Subscriptions";

    public SubscriptionsWorkerOptions Worker { get; set; } = new();
}

public sealed class SubscriptionsWorkerOptions
{
    public bool Enabled { get; set; } = true;
    public int IntervalSeconds { get; set; } = 900;
}
