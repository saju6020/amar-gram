using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Fakes.Administration;

namespace AmarGram.Infrastructure.Tests.Fakes.Administration;

public sealed class NullActiveBranchAccessorTests
{
    [Fact]
    public void GetActiveBranchId_is_always_NoBranch()
    {
        var sut = new NullActiveBranchAccessor();

        Assert.Equal(ActiveBranchResult.NoBranch, sut.GetActiveBranchId());
    }
}
