using System.Net;
using AmarGram.Domain.DomainServices;

namespace AmarGram.Application.Tests.TestSupport;

public sealed class FakeClientIpAccessor(IPAddress? address = null) : IClientIpAccessor
{
    public IPAddress? GetClientIpAddress() => address;
}
