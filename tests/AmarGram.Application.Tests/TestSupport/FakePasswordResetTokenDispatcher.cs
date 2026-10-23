using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;

namespace AmarGram.Application.Tests.TestSupport;

public sealed class FakePasswordResetTokenDispatcher : IPasswordResetTokenDispatcher
{
    public List<PasswordResetDispatchRequest> Dispatched { get; } = [];

    public Task DispatchAsync(PasswordResetDispatchRequest request, CancellationToken ct = default)
    {
        Dispatched.Add(request);
        return Task.CompletedTask;
    }
}
