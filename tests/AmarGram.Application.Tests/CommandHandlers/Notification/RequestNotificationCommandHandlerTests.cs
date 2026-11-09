using AmarGram.Application.CommandHandlers.Notification;
using AmarGram.Application.Commands.Notification;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Notification;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Time.Testing;

namespace AmarGram.Application.Tests.CommandHandlers.Notification;

/// <summary>HO-NTF-001 §15/§16 C3 -- I-B13's intent (dedup race handled by the store) proved at
/// the store boundary; the handler's own pre-check and unknown-variable rejection are proved here.</summary>
public sealed class RequestNotificationCommandHandlerTests
{
    private static RequestNotificationCommandHandler CreateHandler(
        FakeAggregateRootRepository<NotificationRequestAggregate> repository, FakeNotificationRequestStore store) =>
        new(Microsoft.Extensions.Logging.Abstractions.NullLogger<RequestNotificationCommandHandler>.Instance,
            new FakeNotificationTemplateCatalogue(), repository, store, new FakeTimeProvider());

    private static RequestNotificationCommand Command(string? dedupKey = null) => new()
    {
        RequestId = Guid.NewGuid(),
        TemplateKey = NotificationTemplateCatalogue.InventoryBatchRecall,
        RecipientKind = NotificationRecipientKind.Customer.DisplayName,
        RecipientId = Guid.NewGuid(),
        Variables = new Dictionary<string, string> { ["productName"] = "Organic Mustard Oil 1 L", ["lotNumber"] = "L2406-17", ["expiresOn"] = "2027-03-31", ["customerAdvice"] = "Stop using it." },
        DeduplicationKey = dedupKey,
        UserContext = TestUserContext.Create(), CorrelationId = Guid.NewGuid(), ValidateCommand = true
    };

    [Fact]
    public async Task UnknownVariable_ReturnsInvalidNotificationRequest()
    {
        var repository = new FakeAggregateRootRepository<NotificationRequestAggregate>();
        var handler = CreateHandler(repository, new FakeNotificationRequestStore(repository));

        var command = Command();
        var badCommand = new RequestNotificationCommand
        {
            RequestId = command.RequestId, TemplateKey = command.TemplateKey, RecipientKind = command.RecipientKind, RecipientId = command.RecipientId,
            Variables = new Dictionary<string, string> { ["notAVariable"] = "x" },
            UserContext = command.UserContext, CorrelationId = Guid.NewGuid(), ValidateCommand = true
        };

        var response = await handler.HandleAsync(badCommand);

        Assert.False(response.IsSuccess);
        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidNotificationRequest);
        Assert.Empty(repository.Saved);
    }

    [Fact]
    public async Task DeduplicationKeyAlreadyUsed_SucceedsWithoutSavingAgain()
    {
        var repository = new FakeAggregateRootRepository<NotificationRequestAggregate>();
        var store = new FakeNotificationRequestStore(repository);
        var handler = CreateHandler(repository, store);

        var first = await handler.HandleAsync(Command("dedupe-key-1"));
        Assert.True(first.IsSuccess);
        Assert.Single(repository.Saved);

        var second = await handler.HandleAsync(Command("dedupe-key-1"));
        Assert.True(second.IsSuccess);
        Assert.Single(repository.Saved); // still one -- the pre-check found it already used
    }

    [Fact]
    public async Task ConcurrentRace_StoreReportsLoss_StillSucceeds()
    {
        var repository = new FakeAggregateRootRepository<NotificationRequestAggregate>();
        var store = new FakeNotificationRequestStore(repository) { NextSaveLosesRace = true };
        var handler = CreateHandler(repository, store);

        var response = await handler.HandleAsync(Command("dedupe-key-2"));

        Assert.True(response.IsSuccess);
        Assert.Empty(repository.Saved); // the store's own commit lost the race and did not save
    }

    [Fact]
    public async Task ValidRequest_Saves()
    {
        var repository = new FakeAggregateRootRepository<NotificationRequestAggregate>();
        var handler = CreateHandler(repository, new FakeNotificationRequestStore(repository));

        var response = await handler.HandleAsync(Command());

        Assert.True(response.IsSuccess);
        Assert.Single(repository.Saved);
        Assert.Equal(NotificationRequestStatus.Pending, repository.Saved[0].Status);
    }
}
