using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates;

/// <summary>HO-ACC-001 §15, U-D1.</summary>
public sealed class PasswordResetTokenAggregateTests
{
    private static readonly DateTimeOffset IssuedOn = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly Guid Stamp = Guid.NewGuid();

    private static PasswordResetTokenAggregate Issued()
    {
        var token = new PasswordResetTokenAggregate(Guid.NewGuid());
        token.Issue(new PasswordResetTokenIssueDto(
            AccountKind.Customer, Guid.NewGuid(), "hash", Stamp, IssuedOn, IssuedOn.AddMinutes(15),
            PasswordResetChannel.Mobile, TestUserContext.Create(), Guid.NewGuid()));
        return token;
    }

    [Fact]
    public void EnsureUsable_Expired_Throws()
    {
        var token = Issued();
        var ex = Assert.Throws<DomainRuleViolationException>(() => token.EnsureUsable(IssuedOn.AddMinutes(15), Stamp));
        Assert.Equal("PasswordResetTokenExpired", ex.ErrorCode);
    }

    [Fact]
    public void EnsureUsable_Superseded_Throws()
    {
        var token = Issued();
        var ex = Assert.Throws<DomainRuleViolationException>(() => token.EnsureUsable(IssuedOn.AddMinutes(1), Guid.NewGuid()));
        Assert.Equal("PasswordResetTokenSuperseded", ex.ErrorCode);
    }

    [Fact]
    public void EnsureUsable_Fresh_DoesNotThrow()
    {
        var token = Issued();
        var exception = Record.Exception(() => token.EnsureUsable(IssuedOn.AddMinutes(1), Stamp));
        Assert.Null(exception);
    }
}
