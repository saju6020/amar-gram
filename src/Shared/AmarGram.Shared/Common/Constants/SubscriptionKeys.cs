using System.Globalization;

namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §10.3, ADR-241 -- the deterministic keys that make a cycle exactly-once. The idempotency key is what a cycle's order is placed
/// under; the notice key makes a pre-charge notice go once.</summary>
public static class SubscriptionKeys
{
    /// <summary><c>sub:{subscriptionId:N}:{cycleOn:yyyyMMdd}</c>.</summary>
    public static string IdempotencyKey(Guid subscriptionId, DateOnly cycleOn) =>
        $"sub:{subscriptionId:N}:{cycleOn.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}";

    /// <summary><c>sub:notice:{subscriptionId:N}:{cycleOn:yyyyMMdd}</c>.</summary>
    public static string NoticeDeduplicationKey(Guid subscriptionId, DateOnly cycleOn) =>
        $"sub:notice:{subscriptionId:N}:{cycleOn.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}";

    /// <summary>
    /// Orders keeps its idempotency key as a <see cref="Guid"/>; the Guid placed under is the first 16 bytes of the SHA-256 of
    /// <see cref="IdempotencyKey"/>, so one cycle always maps to one order key (and Orders' unique index on customer + key backs it up).
    /// </summary>
    public static Guid OrderIdempotencyGuid(Guid subscriptionId, DateOnly cycleOn)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(IdempotencyKey(subscriptionId, cycleOn)));
        return new Guid(hash.AsSpan(0, 16));
    }
}
