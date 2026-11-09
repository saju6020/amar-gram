using AmarGram.Domain.Aggregates.Administration;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Xunit;

namespace AmarGram.Domain.Tests.Aggregates.Administration;

public sealed class BranchClosureAggregateTests
{
    [Fact]
    public void Cancel_PastClosure_ThrowsPastClosureCannotBeCancelled()
    {
        var closure = new BranchClosureAggregate(Guid.NewGuid());
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        closure.Create(new BranchClosureCreateDto(Guid.NewGuid(), today.AddDays(-1), today.AddDays(-1), ClosureKind.Closure, "Test",
            null, null, TestUserContext.Create(), Guid.NewGuid()));

        var ex = Assert.Throws<DomainRuleViolationException>(() =>
            closure.Cancel(new BranchClosureCancelDto(today, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.PastClosureCannotBeCancelled, ex.ErrorCode);
    }

    [Fact]
    public void Cancel_FutureClosure_Succeeds()
    {
        var closure = new BranchClosureAggregate(Guid.NewGuid());
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        closure.Create(new BranchClosureCreateDto(Guid.NewGuid(), today.AddDays(5), today.AddDays(5), ClosureKind.PublicHoliday, "Test",
            null, null, TestUserContext.Create(), Guid.NewGuid()));

        closure.Cancel(new BranchClosureCancelDto(today, TestUserContext.Create(), Guid.NewGuid()));

        Assert.True(closure.IsCancelled);
    }

    [Fact]
    public void Create_PartialWindowOnMultiDayClosure_ThrowsInvalidClosureWindow()
    {
        var closure = new BranchClosureAggregate(Guid.NewGuid());
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var ex = Assert.Throws<DomainRuleViolationException>(() => closure.Create(new BranchClosureCreateDto(
            Guid.NewGuid(), today.AddDays(1), today.AddDays(2), ClosureKind.Closure, "Test",
            new TimeOnly(12, 0), new TimeOnly(14, 0), TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal(BusinessViolationCodes.InvalidClosureWindow, ex.ErrorCode);
    }
}
