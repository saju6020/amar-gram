using AmarGram.Application.CommandHandlers.Account;
using AmarGram.Application.Commands.Account;
using AmarGram.Application.Tests.TestSupport;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Domain.Events.Account;
using AmarGram.Domain.Models;
using AmarGram.Domain.ValueObjects;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core.Commands;

namespace AmarGram.Application.Tests.CommandHandlers.Account;

/// <summary>HO-P4 BG-19 -- staff notes, tags and the staff-started password reset.</summary>
public sealed class CustomerStaffRecordCommandHandlerTests
{
    private readonly FakeAggregateRootRepository<CustomerAccountAggregate> _customers = new();
    private readonly FakeAggregateRootRepository<CustomerStaffRecordAggregate> _records = new();
    private readonly FakeAggregateRootRepository<PasswordResetTokenAggregate> _tokens = new();
    private readonly FakePasswordResetTokenDispatcher _dispatcher = new();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 25, 9, 0, 0, TimeSpan.Zero));
    private readonly UserContext _staff = TestUserContext.Create();

    private CustomerAccountAggregate SeedCustomer(string? mobile = "01712345678", string? email = null, bool withPassword = false)
    {
        var customer = new CustomerAccountAggregate(Guid.NewGuid());
        customer.Register(new CustomerRegistrationDto(
            "Jane Doe", mobile is null ? null : MobileNumber.Create(mobile), email is null ? null : EmailAddress.Create(email),
            withPassword ? PasswordCredential.Create("h", "a", DateTimeOffset.UtcNow) : null, TestUserContext.Create(), Guid.NewGuid()));
        _customers.Seed(customer);
        return customer;
    }

    private AddCustomerNoteCommandHandler AddNote() => new(NullLogger<AddCustomerNoteCommandHandler>.Instance, _customers, _records, _time);
    private SetCustomerTagsCommandHandler SetTags() => new(NullLogger<SetCustomerTagsCommandHandler>.Instance, _customers, _records);

    private RequestCustomerPasswordResetCommandHandler Reset() => new(
        NullLogger<RequestCustomerPasswordResetCommandHandler>.Instance, _customers, _tokens,
        new FakePasswordResetTokenGenerator(), _dispatcher, _time);

    private AddCustomerNoteCommand NoteCommand(Guid customerId, string text) => new()
    { CustomerId = customerId, NoteId = Guid.NewGuid(), Text = text, UserContext = _staff, CorrelationId = Guid.NewGuid() };

    private static string CodeOf(CommandResponse response) => response.ValidationResult!.Errors.Single().ErrorCode;

    [Fact]
    public async Task AddNote_FirstWriteCreatesTheRecord_AndTheLaterOnesAppend()
    {
        var customer = SeedCustomer();

        Assert.True((await AddNote().HandleAsync(NoteCommand(customer.Id, "Prefers evening delivery"))).IsSuccess);
        Assert.True((await AddNote().HandleAsync(NoteCommand(customer.Id, "Gate code on the invoice"))).IsSuccess);

        var record = Assert.Single(_records.Saved);
        Assert.Single(_records.Updated);
        Assert.Equal(customer.Id, record.Id);
        Assert.Equal(2, record.Notes.Count);
        Assert.All(record.Notes, n => Assert.Equal(_staff.UserId, n.AuthorStaffId));
        Assert.All(record.Notes, n => Assert.Equal(_time.GetUtcNow(), n.CreatedOn));
    }

    [Fact]
    public async Task AddNote_ReturnsTheNoteId()
    {
        var customer = SeedCustomer();
        var command = NoteCommand(customer.Id, "hello");

        var response = await AddNote().HandleAsync(command);

        Assert.Equal(command.NoteId, _records.Saved.Single().Notes.Single().Id);
        Assert.True(response.IsSuccess);
    }

    [Fact]
    public async Task AddNote_UnknownCustomer_IsCustomerNotFound_AndSavesNothing()
    {
        var response = await AddNote().HandleAsync(NoteCommand(Guid.NewGuid(), "x"));

        Assert.Equal(BusinessViolationCodes.CustomerNotFound, CodeOf(response));
        Assert.Empty(_records.Saved);
    }

    [Fact]
    public async Task AddNote_AnAnonymisedCustomer_TakesNoNewPersonalData()
    {
        var customer = SeedCustomer(withPassword: true);
        customer.Anonymise(new CustomerAnonymisationDto(DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));

        var response = await AddNote().HandleAsync(NoteCommand(customer.Id, "x"));

        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(response));
        Assert.Empty(_records.Saved);
    }

    [Fact]
    public async Task AddNote_ABlankNote_IsRefusedByTheAggregate_AndNothingIsSaved()
    {
        var customer = SeedCustomer();

        var response = await AddNote().HandleAsync(NoteCommand(customer.Id, "   "));

        Assert.Equal(BusinessViolationCodes.InvalidCustomerNote, CodeOf(response));
        Assert.Empty(_records.Saved);
    }

    [Fact]
    public async Task SetTags_StoresTheCleanedSet_AndReturnsIt()
    {
        var customer = SeedCustomer();

        var response = await SetTags().HandleAsync(new SetCustomerTagsCommand
        { CustomerId = customer.Id, Tags = [" VIP ", "vip", "Wholesale"], UserContext = _staff, CorrelationId = Guid.NewGuid() });

        Assert.True(response.IsSuccess);
        Assert.Equal(["VIP", "Wholesale"], _records.Saved.Single().Labels);
    }

    [Fact]
    public async Task SetTags_TooMany_IsRefused()
    {
        var customer = SeedCustomer();

        var response = await SetTags().HandleAsync(new SetCustomerTagsCommand
        {
            CustomerId = customer.Id, Tags = Enumerable.Range(0, CustomerStaffRecordRules.MaxTags + 1).Select(i => "t" + i).ToList(),
            UserContext = _staff, CorrelationId = Guid.NewGuid()
        });

        Assert.Equal(BusinessViolationCodes.CustomerTagLimitExceeded, CodeOf(response));
    }

    // ── staff-initiated password reset ───────────────────────────────────────────────────────────

    private RequestCustomerPasswordResetCommand ResetCommand(Guid customerId) => new()
    { CustomerId = customerId, TokenId = Guid.NewGuid(), UserContext = _staff, CorrelationId = Guid.NewGuid() };

    [Fact]
    public async Task Reset_SendsTheLinkToTheCustomersMobile_AndNamesTheStaffMemberOnTheEvent()
    {
        var customer = SeedCustomer(mobile: "01712345678", email: "jane@example.com", withPassword: true);

        var response = await Reset().HandleAsync(ResetCommand(customer.Id));

        Assert.True(response.IsSuccess);
        var token = Assert.Single(_tokens.Saved);
        Assert.Equal(customer.Id, token.AccountId);
        Assert.Equal(AccountKind.Customer, token.AccountKind);
        Assert.Equal(customer.SecurityStamp, token.IssuedForSecurityStamp);
        Assert.Equal(PasswordResetChannel.Mobile, token.Channel);

        var raised = Assert.IsType<PasswordResetRequestedEvent>(token.Events.Last());
        Assert.Equal(_staff.UserId, raised.InitiatedByStaffId);

        var sent = Assert.Single(_dispatcher.Dispatched);
        Assert.Equal(customer.Id, sent.AccountId);
        Assert.Equal(PasswordResetChannel.Mobile, sent.Channel);
        Assert.DoesNotContain("01712345678", sent.MaskedDestination);
    }

    [Fact]
    public async Task Reset_ForAnEmailOnlyCustomer_GoesToTheEmail()
    {
        var customer = SeedCustomer(mobile: null, email: "jane@example.com");

        await Reset().HandleAsync(ResetCommand(customer.Id));

        Assert.Equal(PasswordResetChannel.Email, Assert.Single(_dispatcher.Dispatched).Channel);
    }

    [Fact]
    public async Task Reset_NeverReturnsTheToken()
    {
        var customer = SeedCustomer();

        var response = await Reset().HandleAsync(ResetCommand(customer.Id));

        var sent = Assert.Single(_dispatcher.Dispatched);
        Assert.DoesNotContain(sent.PlainToken, System.Text.Json.JsonSerializer.Serialize(response.Result));
    }

    [Fact]
    public async Task Reset_UnknownCustomer_IsRefused_AndSendsNothing()
    {
        var response = await Reset().HandleAsync(ResetCommand(Guid.NewGuid()));

        Assert.Equal(BusinessViolationCodes.CustomerNotFound, CodeOf(response));
        Assert.Empty(_dispatcher.Dispatched);
        Assert.Empty(_tokens.Saved);
    }

    [Fact]
    public async Task Reset_ForAnAnonymisedCustomer_IsRefused_AndSendsNothing()
    {
        var customer = SeedCustomer(withPassword: true);
        customer.Anonymise(new CustomerAnonymisationDto(DateTimeOffset.UtcNow, TestUserContext.Create(), Guid.NewGuid()));

        var response = await Reset().HandleAsync(ResetCommand(customer.Id));

        Assert.Equal(BusinessViolationCodes.AccountNotActive, CodeOf(response));
        Assert.Empty(_dispatcher.Dispatched);
    }
}
