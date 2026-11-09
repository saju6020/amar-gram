using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Tests.Aggregates;

/// <summary>HO-ACC-001 §15, U-E7.</summary>
public sealed class CustomerNotificationPreferencesAggregateTests
{
    private static CustomerNotificationPreferencesAggregate Opened()
    {
        var preferences = new CustomerNotificationPreferencesAggregate(Guid.NewGuid());
        preferences.Open(new CustomerNotificationPreferencesOpenDto(TestUserContext.Create(), Guid.NewGuid()));
        return preferences;
    }

    [Fact]
    public void ChangePreferences_TransactionalCell_ThrowsAndAppliesNothing()
    {
        var preferences = Opened();

        var ex = Assert.Throws<DomainRuleViolationException>(() => preferences.ChangePreferences(new ChangeNotificationPreferencesDto(
            [new NotificationPreferenceChangeDto(NotificationChannel.Email, NotificationCategory.Transactional, false)],
            "Test", DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal("NotificationPreferenceNotEditable", ex.ErrorCode);
        Assert.Empty(preferences.MarketingConsents);
    }

    [Fact]
    public void ChangePreferences_DuplicateCellInSameRequest_Throws()
    {
        var preferences = Opened();

        var ex = Assert.Throws<DomainRuleViolationException>(() => preferences.ChangePreferences(new ChangeNotificationPreferencesDto(
            [
                new NotificationPreferenceChangeDto(NotificationChannel.Email, NotificationCategory.Marketing, true),
                new NotificationPreferenceChangeDto(NotificationChannel.Email, NotificationCategory.Marketing, false)
            ],
            "Test", DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid())));

        Assert.Equal("DuplicateNotificationPreferenceChange", ex.ErrorCode);
    }

    [Fact]
    public void ChangePreferences_MarketingCell_Applies()
    {
        var preferences = Opened();

        preferences.ChangePreferences(new ChangeNotificationPreferencesDto(
            [new NotificationPreferenceChangeDto(NotificationChannel.Sms, NotificationCategory.Marketing, true)],
            "Test", DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));

        Assert.True(preferences.Permits(NotificationChannel.Sms, NotificationCategory.Marketing));
        Assert.False(preferences.Permits(NotificationChannel.Email, NotificationCategory.Marketing));
        Assert.True(preferences.Permits(NotificationChannel.Email, NotificationCategory.Transactional));
    }
}
