using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Subscription;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Domain.Models;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Api.Controllers;

/// <summary>
/// HO-SUB-001 §12.4 (US-SUB-01 to US-SUB-04) -- the signed-in customer's subscriptions. Every route resolves the subscription <b>by id and caller</b>: someone else's is
/// <c>404</c>, the same answer as one that does not exist (ADR-248). Commands run in-process and answer with the real result -- <c>201</c> for a new subscription, <c>200</c>
/// with a <c>SubscriptionChangeResult</c> for a change (it names the date the change takes effect, US-SUB-02 AC2), <c>400</c> with <c>ValidationResponse</c> for a refusal,
/// <c>409</c> for a stale version; never <c>202</c> (ADR-013). No route is public.
/// </summary>
[ApiController]
[Route("api/customers/me/subscriptions")]
[RequireCustomerSession]
public sealed class CustomerSubscriptionsController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet("options")]
    public async Task<IActionResult> Options([FromQuery] Guid skuId)
    {
        Response.Headers.CacheControl = "no-store";
        var user = userContextProvider.GetUserContext();
        var response = await dispatcher.GetResultAsync(new GetSubscriptionOptionsQuery { CustomerId = user.UserId, SkuId = skuId, UserContext = user, CorrelationId = Guid.NewGuid() });
        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    [HttpGet("payment-methods")]
    public async Task<IActionResult> PaymentMethods([FromQuery] Guid skuId, [FromQuery] int? quantity, [FromQuery] Guid? deliveryAddressId, [FromQuery] Guid? pickupBranchId)
    {
        Response.Headers.CacheControl = "no-store";
        var user = userContextProvider.GetUserContext();
        var response = await dispatcher.GetResultAsync(new GetSubscriptionPaymentMethodsQuery
        {
            CustomerId = user.UserId, SkuId = skuId, Quantity = quantity ?? 1, DeliveryAddressId = deliveryAddressId, PickupBranchId = pickupBranchId,
            UserContext = user, CorrelationId = Guid.NewGuid(),
        });
        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    /// <summary>The caller's subscriptions; <c>status=live</c> (Active, Paused, Suspended) or <c>status=cancelled</c>, default all.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        Response.Headers.CacheControl = "no-store";
        bool? live = status?.ToLowerInvariant() switch { null or "" or "all" => null, "live" => true, "cancelled" => false, _ => (bool?)null };
        if (!string.IsNullOrEmpty(status) && status.ToLowerInvariant() is not ("live" or "cancelled" or "all")) return BadRequest(new { error = "status must be live or cancelled." });

        var user = userContextProvider.GetUserContext();
        var query = new GetCustomerSubscriptionsQuery { CustomerId = user.UserId, Live = live, UserContext = user, CorrelationId = Guid.NewGuid() };
        if (PagingHelper.ApplyPaging(query, pageNumber, pageSize) is { } invalid) return invalid;

        return Ok((await dispatcher.GetResultAsync(query)).Result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        Response.Headers.CacheControl = "no-store";
        var user = userContextProvider.GetUserContext();
        var response = await dispatcher.GetResultAsync(new GetCustomerSubscriptionDetailQuery { CustomerId = user.UserId, SubscriptionId = id, UserContext = user, CorrelationId = Guid.NewGuid() });
        if (response.Result is not { } detail) return NotFound();

        return Ok(SubscriptionHttp.Flatten(this, detail.Subscription, ("cycles", detail.Cycles)));
    }

    [HttpGet("{id:guid}/cycles")]
    public async Task<IActionResult> Cycles(Guid id, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        Response.Headers.CacheControl = "no-store";
        var user = userContextProvider.GetUserContext();
        var query = new GetSubscriptionCyclesQuery { SubscriptionId = id, CustomerId = user.UserId, UserContext = user, CorrelationId = Guid.NewGuid() };
        if (PagingHelper.ApplyPaging(query, pageNumber, pageSize) is { } invalid) return invalid;

        var response = await dispatcher.GetResultAsync(query);
        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    /// <summary>US-SUB-01 AC1 -- start a subscription. <c>201</c> with the <c>SubscriptionView</c> (it carries <c>nextDeliveryOn</c>).</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSubscriptionRequest request)
    {
        if (!TryFulfilmentAndPayment(request.Fulfilment, request.PaymentMethod, out var fulfilment, out var payment, out var invalid)) return invalid!;

        var user = userContextProvider.GetUserContext();
        var id = Guid.NewGuid();
        var response = await dispatcher.SendAsync(new CreateSubscriptionCommand
        {
            SubscriptionId = id, SkuId = request.SkuId, Quantity = request.Quantity, IntervalWeeks = request.IntervalWeeks, FirstDeliveryOn = request.FirstDeliveryOn,
            Fulfilment = fulfilment!, DeliveryAddressId = request.DeliveryAddressId, PickupBranchId = request.PickupBranchId, PaymentMethod = payment!,
            UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        });

        if (!response.IsSuccess) return SubscriptionHttp.Failure(this, response);

        var view = await ViewAsync((Guid)response.Result, user);
        return Created($"/api/customers/me/subscriptions/{id}", view);
    }

    [HttpPut("{id:guid}/terms")]
    public async Task<IActionResult> ChangeTerms(Guid id, [FromBody] ChangeSubscriptionTermsRequest request)
    {
        if (!TryFulfilmentAndPayment(request.Fulfilment, request.PaymentMethod, out var fulfilment, out var payment, out var invalid)) return invalid!;

        return await ChangeAsync(id, user => dispatcher.SendAsync(new ChangeSubscriptionTermsCommand
        {
            SubscriptionId = id, ExpectedVersion = request.Version, Quantity = request.Quantity, IntervalWeeks = request.IntervalWeeks, Fulfilment = fulfilment!,
            DeliveryAddressId = request.DeliveryAddressId, PickupBranchId = request.PickupBranchId, PaymentMethod = payment!,
            UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        }));
    }

    /// <summary>US-SUB-03 -- skip the delivery of <c>cycleOn</c>; a stale link is <c>400 CycleNoLongerSkippable</c> naming the next skippable date.</summary>
    [HttpPost("{id:guid}/skip")]
    public Task<IActionResult> Skip(Guid id, [FromBody] SkipSubscriptionRequest request) =>
        ChangeAsync(id, user => dispatcher.SendAsync(new SkipSubscriptionDeliveryCommand
        { SubscriptionId = id, CycleOn = request.CycleOn, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true }));

    [HttpPost("{id:guid}/pause")]
    public Task<IActionResult> Pause(Guid id) =>
        ChangeAsync(id, user => dispatcher.SendAsync(new PauseSubscriptionCommand { SubscriptionId = id, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true }));

    /// <summary>Resume a paused subscription (<c>400 SubscriptionSuspended</c> for one the shop suspended).</summary>
    [HttpPost("{id:guid}/resume")]
    public Task<IActionResult> Resume(Guid id, [FromBody] ResumeSubscriptionRequest? request) =>
        ChangeAsync(id, user => dispatcher.SendAsync(new ResumeSubscriptionCommand
        { SubscriptionId = id, FirstDeliveryOn = request?.FirstDeliveryOn, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true }));

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelSubscriptionRequest request)
    {
        if (!EnumQueryParameter.TryParse<SubscriptionCancellationReason>(request.Reason, out var reason) || reason is null)
            return BadRequest(new { error = "reason must be one of NoLongerNeeded, TooMuchStock, TastesDidNotSuit, TooExpensive, SwitchingProduct, Other." });

        return await ChangeAsync(id, user => dispatcher.SendAsync(new CancelSubscriptionCommand
        { SubscriptionId = id, Reason = reason, Note = request.Note, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true }));
    }

    /// <summary>Withdraw every scheduled change; <c>400 NoPendingChange</c> when there is none.</summary>
    [HttpDelete("{id:guid}/pending-changes")]
    public Task<IActionResult> WithdrawPending(Guid id) =>
        ChangeAsync(id, user => dispatcher.SendAsync(new WithdrawPendingSubscriptionChangesCommand
        { SubscriptionId = id, UserContext = user, CorrelationId = Guid.NewGuid(), ValidateCommand = true }));

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────

    /// <summary>Sends a change command and answers <c>200 SubscriptionChangeResult { subscription, appliedImmediately, appliesFromCycleOn?, message }</c>.</summary>
    private async Task<IActionResult> ChangeAsync(Guid id, Func<UserContext, Task<CommandResponse>> send)
    {
        var user = userContextProvider.GetUserContext();
        var response = await send(user);
        if (!response.IsSuccess) return SubscriptionHttp.Failure(this, response);

        var outcome = (SubscriptionChangeOutcome)response.Result;
        var view = await ViewAsync(id, user);
        return view is null
            ? NotFound()
            : Ok(new { subscription = view, appliedImmediately = outcome.AppliedImmediately, appliesFromCycleOn = outcome.AppliesFromCycleOn, message = outcome.Message });
    }

    private async Task<SubscriptionViewModel?> ViewAsync(Guid id, UserContext user) =>
        (await dispatcher.GetResultAsync(new GetCustomerSubscriptionDetailQuery { CustomerId = user.UserId, SubscriptionId = id, UserContext = user, CorrelationId = Guid.NewGuid() })).Result?.Subscription;

    private bool TryFulfilmentAndPayment(
        string? fulfilmentText, string? paymentText, out SubscriptionFulfilment? fulfilment, out SubscriptionPaymentMethod? payment, out IActionResult? invalid)
    {
        invalid = null;
        payment = null;
        if (!EnumQueryParameter.TryParse(fulfilmentText, out fulfilment) || fulfilment is null)
        {
            invalid = BadRequest(new { error = "fulfilment must be Delivery or Pickup." });
            return false;
        }

        if (!EnumQueryParameter.TryParse(paymentText, out payment) || payment is null)
        {
            invalid = BadRequest(new { error = "paymentMethod must be CashOnDelivery, BankTransfer or PayAtPickup." });
            return false;
        }

        return true;
    }
}
