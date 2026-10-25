using AmarGram.Application.CommandHandlers.Inventory;
using AmarGram.Application.CommandHandlers.Validators;
using AmarGram.Application.Commands.Inventory;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Inventory;
using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Application.Tests.CommandHandlers.Inventory;

/// <summary>HO-P4 BG-18 -- save (autosave upsert), discard, the per-staff limit and the owner-only rule.</summary>
public sealed class GoodsReceiptDraftHandlerTests
{
    private sealed class FixedCounter(int open) : IGoodsReceiptDraftCounter
    {
        public Task<int> CountOpenAsync(Guid ownerId, CancellationToken ct) => Task.FromResult(open);
    }

    private static UserContext Staff() => new(Guid.NewGuid(), Guid.NewGuid()) { Roles = ["Inventory"] };

    private static GoodsReceiptDraftLineInput Line(decimal accepted = 3m) =>
        new(Guid.NewGuid(), null, null, null, null, accepted, 0m, null, null, null, false, null, null, null);

    private static SaveGoodsReceiptDraftCommand Save(Guid draftId, UserContext user, params GoodsReceiptDraftLineInput[] lines) => new()
    {
        DraftId = draftId, BranchId = Guid.NewGuid(), DeliveryReference = "DN-7", Lines = lines, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true
    };

    private static SaveGoodsReceiptDraftCommandHandler SaveHandler(FakeAggregateRootRepository<GoodsReceiptDraftAggregate> repository, int open = 0) =>
        new(NullLogger<SaveGoodsReceiptDraftCommandHandler>.Instance, repository, new FixedCounter(open));

    [Fact]
    public async Task Save_FirstTimeCreatesTheDraft_ThenReplacesItInPlace()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var handler = SaveHandler(repository);
        var user = Staff();
        var id = Guid.NewGuid();

        var first = await handler.HandleAsync(Save(id, user, Line(), Line()));
        var second = await handler.HandleAsync(Save(id, user, Line()));

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Single(repository.Saved);
        Assert.Single(repository.Updated);
        var saved = (SavedGoodsReceiptDraft)second.Result!;
        Assert.Equal(id, saved.DraftId);
        Assert.Equal(2, saved.Version);
        Assert.Single(repository.Saved.Single().Lines);
    }

    [Fact]
    public async Task Save_AnotherStaffMembersDraft_AnswersAsNotFound()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var handler = SaveHandler(repository);
        var id = Guid.NewGuid();
        await handler.HandleAsync(Save(id, Staff(), Line()));

        var response = await handler.HandleAsync(Save(id, Staff(), Line()));

        Assert.False(response.IsSuccess);
        var error = Assert.Single(response.ValidationResult!.Errors);
        Assert.Equal(BusinessViolationCodes.GoodsReceiptDraftNotFound, error.ErrorCode);
        Assert.Equal(InventoryRules.NotFoundResource, error.ResourceName);
    }

    [Fact]
    public async Task Save_ANewDraftPastTheLimit_IsRefused_ButAnExistingOneStillSaves()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var user = Staff();
        var existing = Guid.NewGuid();
        await SaveHandler(repository).HandleAsync(Save(existing, user, Line()));

        var atLimit = SaveHandler(repository, open: InventoryRules.MaxGoodsReceiptDraftsPerStaff);

        var created = await atLimit.HandleAsync(Save(Guid.NewGuid(), user, Line()));
        var resaved = await atLimit.HandleAsync(Save(existing, user, Line(), Line()));

        Assert.False(created.IsSuccess);
        Assert.Contains(created.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.GoodsReceiptDraftLimitReached);
        Assert.True(resaved.IsSuccess);
    }

    [Fact]
    public async Task Save_ADiscardedDraft_IsNotFound_NoLateAutosaveBringsItBack()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var user = Staff();
        var id = Guid.NewGuid();
        await SaveHandler(repository).HandleAsync(Save(id, user, Line()));
        await new DiscardGoodsReceiptDraftCommandHandler(NullLogger<DiscardGoodsReceiptDraftCommandHandler>.Instance, repository, new FakeTimeProvider(DateTimeOffset.UtcNow))
            .HandleAsync(new DiscardGoodsReceiptDraftCommand { DraftId = id, UserContext = user, CorrelationId = Guid.NewGuid() });

        var late = await SaveHandler(repository).HandleAsync(Save(id, user, Line()));

        Assert.False(late.IsSuccess);
        Assert.Equal(InventoryRules.NotFoundResource, late.ValidationResult!.Errors.Single().ResourceName);
    }

    [Fact]
    public async Task Save_AnOverlongField_ReturnsInvalidGoodsReceiptDraft()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var command = new SaveGoodsReceiptDraftCommand
        {
            DraftId = Guid.NewGuid(), BranchId = Guid.NewGuid(), Lines = Enumerable.Range(0, InventoryRules.MaxReceiptLines + 1).Select(_ => Line()).ToArray(),
            UserContext = Staff(), CorrelationId = Guid.NewGuid()
        };

        var response = await SaveHandler(repository).HandleAsync(command);

        Assert.Contains(response.ValidationResult!.Errors, e => e.ErrorCode == BusinessViolationCodes.InvalidGoodsReceiptDraft);
        Assert.Empty(repository.Saved);
    }

    [Fact]
    public async Task Discard_ByTheOwner_Succeeds_AndAgainIsStillASuccess()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var user = Staff();
        var id = Guid.NewGuid();
        await SaveHandler(repository).HandleAsync(Save(id, user, Line()));
        var handler = new DiscardGoodsReceiptDraftCommandHandler(NullLogger<DiscardGoodsReceiptDraftCommandHandler>.Instance, repository, new FakeTimeProvider(DateTimeOffset.UtcNow));
        var command = new DiscardGoodsReceiptDraftCommand { DraftId = id, UserContext = user, CorrelationId = Guid.NewGuid() };

        Assert.True((await handler.HandleAsync(command)).IsSuccess);
        Assert.True((await handler.HandleAsync(command)).IsSuccess);
        Assert.False(repository.Saved.Single().IsOpen);
    }

    [Fact]
    public async Task Discard_UnknownOrSomeoneElses_IsNotFound()
    {
        var repository = new FakeAggregateRootRepository<GoodsReceiptDraftAggregate>();
        var id = Guid.NewGuid();
        await SaveHandler(repository).HandleAsync(Save(id, Staff(), Line()));
        var handler = new DiscardGoodsReceiptDraftCommandHandler(NullLogger<DiscardGoodsReceiptDraftCommandHandler>.Instance, repository, new FakeTimeProvider(DateTimeOffset.UtcNow));

        var others = await handler.HandleAsync(new DiscardGoodsReceiptDraftCommand { DraftId = id, UserContext = Staff(), CorrelationId = Guid.NewGuid() });
        var unknown = await handler.HandleAsync(new DiscardGoodsReceiptDraftCommand { DraftId = Guid.NewGuid(), UserContext = Staff(), CorrelationId = Guid.NewGuid() });

        foreach (var response in new[] { others, unknown })
        {
            Assert.False(response.IsSuccess);
            Assert.Equal(InventoryRules.NotFoundResource, response.ValidationResult!.Errors.Single().ResourceName);
        }

        Assert.True(repository.Saved.Single().IsOpen);
    }

    [Fact]
    public void Validator_ChecksShapeOnly_AHalfFilledLineIsFine_APrecisionOverflowIsNot()
    {
        var validator = new SaveGoodsReceiptDraftCommandValidator();

        Assert.True(validator.Validate(Save(Guid.NewGuid(), Staff(), Line(accepted: 0m))).IsValid);
        Assert.False(validator.Validate(Save(Guid.NewGuid(), Staff(), Line(accepted: 1.2345m))).IsValid);
        Assert.False(validator.Validate(Save(Guid.Empty, Staff(), Line())).IsValid);
    }
}
