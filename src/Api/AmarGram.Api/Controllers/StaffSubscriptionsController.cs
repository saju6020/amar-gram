using System.Globalization;
using System.Text;
using AmarGram.Api.Authorization;
using AmarGram.Api.Contracts.Subscription;
using AmarGram.Application.Commands.Subscription;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using AmarGram.Shared.Common.Helpers;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;

namespace AmarGram.Api.Controllers;

/// <summary>
/// HO-SUB-001 §12.4 (ADR-248) -- staff subscription routes. Subscriptions are not branch-scoped (a customer's subscription is theirs at any branch, OQ-15), so none
/// resolves an active branch. <c>Subscriptions.View</c> reads, <c>Subscriptions.Manage</c> reinstates and cancels, <c>Subscriptions.Export</c> exports; the mapping is
/// inferred from Appendix D "Orders &amp; fulfilment" and flagged in ADR-248. Every write answers with the real result (never <c>202</c>).
/// </summary>
[ApiController]
[Route("api/staff/subscriptions")]
public sealed class StaffSubscriptionsController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> List(
        [FromQuery] string? status, [FromQuery] string? suspensionReason, [FromQuery] string? paymentMethod, [FromQuery] string? q, [FromQuery] string? sort,
        [FromQuery] string? nextDeliveryOn, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        if (!TryFilters(status, suspensionReason, paymentMethod, out var s, out var r, out var m, out var invalid)) return invalid!;
        if (!TryDueDate(nextDeliveryOn, out var due, out invalid)) return invalid!;

        var user = userContextProvider.GetUserContext();
        var query = new GetStaffSubscriptionsQuery { Status = s, SuspensionReason = r, PaymentMethod = m, Text = q, Sort = sort, NextDeliveryOn = due, UserContext = user, CorrelationId = Guid.NewGuid() };
        if (PagingHelper.ApplyPaging(query, pageNumber, pageSize) is { } bad) return bad;

        return Ok((await dispatcher.GetResultAsync(query)).Result);
    }

    /// <summary>US-SUB-06 AC2 -- the unpaid-subscriptions worklist: suspended for unpaid orders, and at-risk.</summary>
    [HttpGet("unpaid")]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> Unpaid([FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        var query = new GetUnpaidSubscriptionsQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() };
        if (PagingHelper.ApplyPaging(query, pageNumber, pageSize) is { } bad) return bad;

        return Ok((await dispatcher.GetResultAsync(query)).Result);
    }

    /// <summary>The dashboard's "Subscription orders due tomorrow" (BG-15): <c>{ dueOn, count, liveCount, suspendedCount, commerceTimeZoneId }</c>.</summary>
    [HttpGet("due-tomorrow")]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> DueTomorrow()
    {
        Response.Headers.CacheControl = "no-store";
        return Ok((await dispatcher.GetResultAsync(new GetSubscriptionDueTomorrowQuery { UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() })).Result);
    }

    /// <summary>Streamed CSV, at most <see cref="SubscriptionRules.MaxExportRows"/> rows (<c>413</c> above), with the CSV-injection guard on every text cell.</summary>
    [HttpGet("export.csv")]
    [RequireAction(Actions.Subscriptions.Export)]
    public async Task<IActionResult> Export([FromQuery] string? status, [FromQuery] string? suspensionReason, [FromQuery] string? paymentMethod, [FromQuery] string? q, [FromQuery] string? sort,
        [FromQuery] string? nextDeliveryOn)
    {
        if (!TryFilters(status, suspensionReason, paymentMethod, out var s, out var r, out var m, out var invalid)) return invalid!;
        if (!TryDueDate(nextDeliveryOn, out var due, out invalid)) return invalid!;

        var rows = (await dispatcher.GetResultAsync(new ExportSubscriptionsQuery
        { Status = s, SuspensionReason = r, PaymentMethod = m, Text = q, Sort = sort, NextDeliveryOn = due, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() })).Result ?? [];
        if (rows.Count > SubscriptionRules.MaxExportRows) return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "Too many rows to export. Narrow the filters." });

        var csv = InventoryCsv.Build(
            ["SubscriptionId", "Customer", "Mobile", "Product", "Variant", "Quantity", "IntervalWeeks", "Status", "SuspensionReason", "NextDeliveryOn", "PaymentMethod", "UnpaidStreak"],
            rows.Select(x => (IReadOnlyList<object?>)[x.Id, x.Customer.Name, x.Customer.Mobile, x.Product.ProductName, x.Product.VariantLabel, x.Quantity, x.IntervalWeeks, x.Status,
                x.SuspensionReason, x.NextDeliveryOn, x.PaymentMethod, x.UnpaidStreak]));
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "subscriptions.csv");
    }

    [HttpGet("{id:guid}")]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> Get(Guid id)
    {
        Response.Headers.CacheControl = "no-store";
        var response = await dispatcher.GetResultAsync(new GetStaffSubscriptionDetailQuery { SubscriptionId = id, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        if (response.Result is not { } d) return NotFound();

        return Ok(SubscriptionHttp.Flatten(
            this, d.Subscription, ("customer", d.Customer), ("cycles", d.Cycles), ("cancellationReason", d.CancellationReason), ("cancellationNote", d.CancellationNote),
            ("suspendedOn", d.SuspendedOn), ("reinstatement", d.Reinstatement), ("allowedStaffActions", d.AllowedStaffActions)));
    }

    [HttpGet("{id:guid}/cycles")]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> Cycles(Guid id, [FromQuery] int? pageNumber, [FromQuery] int? pageSize)
    {
        var query = new GetSubscriptionCyclesQuery { SubscriptionId = id, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() };
        if (PagingHelper.ApplyPaging(query, pageNumber, pageSize) is { } bad) return bad;

        var response = await dispatcher.GetResultAsync(query);
        return response.Result is null ? NotFound() : Ok(response.Result);
    }

    /// <summary>US-SUB-06 -- restart a suspended subscription with a reason; <c>200 SubscriptionView</c>.</summary>
    [HttpPost("{id:guid}/reinstate")]
    [RequireAction(Actions.Subscriptions.Manage)]
    public async Task<IActionResult> Reinstate(Guid id, [FromBody] ReinstateSubscriptionRequest request)
    {
        var response = await dispatcher.SendAsync(new ReinstateSubscriptionCommand
        {
            SubscriptionId = id, Reason = request.Reason ?? string.Empty, FirstDeliveryOn = request.FirstDeliveryOn, UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        });

        return response.IsSuccess ? await ViewResultAsync(id) : SubscriptionHttp.Failure(this, response);
    }

    /// <summary>Staff cancel any subscription with <c>StaffCancelled</c> and a note; <c>200 SubscriptionView</c>.</summary>
    [HttpPost("{id:guid}/cancel")]
    [RequireAction(Actions.Subscriptions.Manage)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] StaffCancelSubscriptionRequest request)
    {
        var response = await dispatcher.SendAsync(new CancelSubscriptionCommand
        {
            SubscriptionId = id, Reason = SubscriptionCancellationReason.StaffCancelled, Note = request.Note, ByStaff = true, UserContext = userContextProvider.GetUserContext(),
            CorrelationId = Guid.NewGuid(), ValidateCommand = true,
        });

        return response.IsSuccess ? await ViewResultAsync(id) : SubscriptionHttp.Failure(this, response);
    }

    private async Task<IActionResult> ViewResultAsync(Guid id)
    {
        var detail = (await dispatcher.GetResultAsync(new GetStaffSubscriptionDetailQuery { SubscriptionId = id, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() })).Result;
        return detail is null ? NotFound() : Ok(detail.Subscription);
    }

    /// <summary>The optional <c>nextDeliveryOn</c> filter: a commerce-zone local date, <c>yyyy-MM-dd</c> exactly; absent or blank means no filter.</summary>
    private bool TryDueDate(string? text, out DateOnly? due, out IActionResult? invalid)
    {
        invalid = null;
        due = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            invalid = BadRequest(new { error = "nextDeliveryOn must be yyyy-MM-dd." });
            return false;
        }

        due = parsed;
        return true;
    }

    private bool TryFilters(
        string? status, string? suspensionReason, string? paymentMethod,
        out SubscriptionStatus? s, out SubscriptionSuspensionReason? r, out SubscriptionPaymentMethod? m, out IActionResult? invalid)
    {
        invalid = null;
        r = null;
        m = null;
        if (!EnumQueryParameter.TryParse(status, out s)) { invalid = BadRequest(new { error = "status is not a subscription status." }); return false; }
        if (!EnumQueryParameter.TryParse(suspensionReason, out r)) { invalid = BadRequest(new { error = "suspensionReason is not a suspension reason." }); return false; }
        if (!EnumQueryParameter.TryParse(paymentMethod, out m)) { invalid = BadRequest(new { error = "paymentMethod is not a payment method." }); return false; }
        return true;
    }
}

/// <summary>HO-SUB-001 §12.4 (HO-P4 customer "Subscriptions" tab) -- <c>GET /api/staff/customers/{customerId}/subscriptions</c>: the live subscriptions and the cancelled and
/// suspended counts. <c>Subscriptions.View</c>; an unknown customer simply has none.</summary>
[ApiController]
[Route("api/staff/customers/{customerId:guid}/subscriptions")]
public sealed class StaffCustomerSubscriptionsController(IInMemoryDispatcher dispatcher, IUserContextProvider userContextProvider) : ControllerBase
{
    [HttpGet]
    [RequireAction(Actions.Subscriptions.View)]
    public async Task<IActionResult> Summary(Guid customerId)
    {
        Response.Headers.CacheControl = "no-store";
        var response = await dispatcher.GetResultAsync(new GetCustomerSubscriptionSummaryQuery
        { CustomerId = customerId, UserContext = userContextProvider.GetUserContext(), CorrelationId = Guid.NewGuid() });
        return Ok(new { live = response.Result!.Live, cancelledCount = response.Result.CancelledCount, suspendedCount = response.Result.SuspendedCount });
    }
}
