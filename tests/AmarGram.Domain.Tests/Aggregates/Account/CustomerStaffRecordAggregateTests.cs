using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Exceptions;
using AmarGram.Domain.Models;
using AmarGram.Domain.Tests.TestSupport;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Core.Events;
using Xunit;

namespace AmarGram.Domain.Tests.Aggregates.Account;

/// <summary>HO-P4 BG-19 -- staff notes and tags on a customer: the aggregate's own rules, and that its events carry ids and counts, never text.</summary>
public sealed class CustomerStaffRecordAggregateTests
{
    private static CustomerStaffRecordAggregate Open()
    {
        var record = new CustomerStaffRecordAggregate(Guid.NewGuid());
        record.Open(new CustomerStaffRecordOpenDto(TestUserContext.Create(), Guid.NewGuid()));
        return record;
    }

    private static CustomerNoteAddDto Note(string text, Guid? author = null) =>
        new(Guid.NewGuid(), author ?? Guid.NewGuid(), text, DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid());

    private static CustomerTagsSetDto Tags(params string[] tags) => new(tags, TestUserContext.Create(), Guid.NewGuid());

    [Fact]
    public void AddNote_StoresTheTrimmedText_WithAuthorAndTime_AndRaisesAnIdsOnlyEvent()
    {
        var record = Open();
        var author = Guid.NewGuid();

        var dto = Note("  Prefers evening delivery  ", author);
        record.AddNote(dto);

        var note = Assert.Single(record.Notes);
        Assert.Equal("Prefers evening delivery", note.Text);
        Assert.Equal(author, note.AuthorStaffId);
        Assert.Equal(dto.AddedOn, note.CreatedOn);

        var raised = Assert.IsType<CustomerStaffNoteAddedEvent>(record.Events.Last());
        Assert.Equal(record.Id, raised.CustomerId);
        Assert.Equal(dto.NoteId, raised.NoteId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void AddNote_BlankText_IsRefused(string text)
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().AddNote(Note(text)));
        Assert.Equal(BusinessViolationCodes.InvalidCustomerNote, ex.ErrorCode);
    }

    [Fact]
    public void AddNote_OverTheLengthLimit_IsRefused_AtTheLimitItIsKept()
    {
        var record = Open();
        record.AddNote(Note(new string('a', CustomerStaffRecordRules.NoteMaxLength)));

        var ex = Assert.Throws<DomainRuleViolationException>(() => record.AddNote(Note(new string('a', CustomerStaffRecordRules.NoteMaxLength + 1))));
        Assert.Equal(BusinessViolationCodes.InvalidCustomerNote, ex.ErrorCode);
        Assert.Single(record.Notes);
    }

    [Fact]
    public void AddNote_BeyondTheNoteCap_IsRefused()
    {
        var record = Open();
        for (var i = 0; i < CustomerStaffRecordRules.MaxNotes; i++) record.AddNote(Note("n" + i));

        var ex = Assert.Throws<DomainRuleViolationException>(() => record.AddNote(Note("one too many")));
        Assert.Equal(BusinessViolationCodes.CustomerNoteLimitExceeded, ex.ErrorCode);
    }

    [Fact]
    public void SetTags_TrimsAndDeduplicatesCaseInsensitively_KeepingTheFirstSpelling()
    {
        var record = Open();

        record.SetTags(Tags(" VIP ", "vip", "Wholesale", "WHOLESALE"));

        Assert.Equal(["VIP", "Wholesale"], record.Labels);
        var raised = Assert.IsType<CustomerTagsChangedEvent>(record.Events.Last());
        Assert.Equal(2, raised.TagCount);
    }

    [Fact]
    public void SetTags_TheSameSetAgain_ChangesNothing_AndRaisesNothing()
    {
        var record = Open();
        record.SetTags(Tags("VIP"));
        var events = record.Events.Count;
        var version = record.Version;

        record.SetTags(Tags("VIP"));

        Assert.Equal(events, record.Events.Count);
        Assert.Equal(version, record.Version);
    }

    [Fact]
    public void SetTags_AnEmptySet_ClearsTheTags()
    {
        var record = Open();
        record.SetTags(Tags("VIP"));

        record.SetTags(Tags());

        Assert.Empty(record.Labels);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0123456789012345678901234567890")] // 31 characters
    public void SetTags_ABlankOrTooLongTag_IsRefused(string tag)
    {
        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().SetTags(Tags(tag)));
        Assert.Equal(BusinessViolationCodes.InvalidCustomerTag, ex.ErrorCode);
    }

    [Fact]
    public void SetTags_MoreThanTheCap_IsRefused()
    {
        var tags = Enumerable.Range(0, CustomerStaffRecordRules.MaxTags + 1).Select(i => "t" + i).ToArray();

        var ex = Assert.Throws<DomainRuleViolationException>(() => Open().SetTags(Tags(tags)));
        Assert.Equal(BusinessViolationCodes.CustomerTagLimitExceeded, ex.ErrorCode);
    }

    [Fact]
    public void Clear_RemovesNotesAndTags_AndRaisesTheClearedEvent_OnlyWhenThereWasSomething()
    {
        var record = Open();
        record.AddNote(Note("something personal"));
        record.SetTags(Tags("VIP"));

        record.Clear(new CustomerStaffRecordClearDto(TestUserContext.Create(), Guid.NewGuid()));

        Assert.Empty(record.Notes);
        Assert.Empty(record.Labels);
        Assert.IsType<CustomerStaffRecordClearedEvent>(record.Events.Last());

        var events = record.Events.Count;
        record.Clear(new CustomerStaffRecordClearDto(TestUserContext.Create(), Guid.NewGuid()));
        Assert.Equal(events, record.Events.Count);
    }

    [Fact]
    public void TheEvents_HaveNoTextProperty_ThatCouldCarryTheNoteOrTags()
    {
        foreach (var type in new[] { typeof(CustomerStaffNoteAddedEvent), typeof(CustomerTagsChangedEvent), typeof(CustomerStaffRecordClearedEvent) })
        {
            Assert.DoesNotContain(
                type.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.DeclaredOnly),
                p => p.PropertyType == typeof(string));
            Assert.True(typeof(Event).IsAssignableFrom(type));
        }
    }
}
