using AmarGram.Domain.DomainServices;

namespace AmarGram.Application.Tests.TestSupport;

public sealed class FakeBreachedPasswordChecker(bool isBreached = false) : IBreachedPasswordChecker
{
    public Task<bool> IsBreachedAsync(string plaintext, CancellationToken ct = default) => Task.FromResult(isBreached);
}
