using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Common.Security;
using Platform.Infrastructure.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Api.Filters;

/// <summary>
/// HO-ACC-001 §12.4 / ADR-026, extended by HO-ADM-001 §12.5. Registered <b>alongside</b>
/// <see cref="ConcurrencyExceptionFilter"/>, never widening it. A `23505` on the mobile or email
/// unique index maps to the <b>same</b> `400` the handler's own pre-check would have returned
/// (<see cref="AccountMessages"/> -- so the two paths cannot drift, §20.6); a primary-key collision
/// on the address book or preferences (their first-write race) maps to `409`. HO-ADM-001 adds: the
/// branch code, rate effective-date, content slug and policy
/// indexes -> the same `400` their own pre-checks return; the staff roster's (staff, branch)
/// uniqueness and a first-write race on a settings scope row -> `409`. A `23P01` (exclusion
/// violation) on the leave request's overlap-guard GiST constraint maps to the same `400` the
/// handler's own overlap pre-check returns (gate fix 2026-09-26). Any other
/// constraint is rethrown -- an unexpected `23505`/`23P01` is a bug, not something to paper over.
/// </summary>
public sealed class UniqueConstraintExceptionFilter : IExceptionFilter, IAsyncExceptionFilter
{
    private static readonly HashSet<string> MobileIndexes = ["ix_customer_account_mobile_number", "ix_staff_account_mobile_number"];
    private static readonly HashSet<string> EmailIndexes = ["ix_customer_account_email_address", "ix_staff_account_email_address"];
    private static readonly HashSet<string> FirstWriteRaceTables = ["customer_address_book", "customer_notification_preferences", "business_settings"];
    // HO-NTF-001 §12.5 (deviation from §13's file list, recorded in the implementation report):
    // "ix_notification_template_key" -- a first-save race on a template's own aggregate creation
    // (two admins customising the same not-yet-customised template at once) -> 409, same shape as
    // ix_staff_roster_staff_branch. ix_notification_request_dedup is handled INSIDE C3
    // (RequestNotificationCommandHandler) and never reaches this filter.
    private static readonly HashSet<string> ConflictIndexes = ["ix_staff_roster_staff_branch", "ix_notification_template_key"];

    // HO-SHP-001 §12.5 -- messages come from ShopMessages, shared with each handler's own
    // pre-check (ShopMessages' own doc comment), so the sequential and concurrent-race paths for
    // the same rule cannot drift.
    private static readonly Dictionary<string, (string Code, string Message, string Property)> ShopBadRequestIndexes = new()
    {
        ["ix_product_slug"] = (BusinessViolationCodes.SlugAlreadyInUse, ShopMessages.SlugAlreadyInUse, "Slug"),
        ["ix_sku_code"] = (BusinessViolationCodes.SkuCodeAlreadyInUse, ShopMessages.SkuCodeAlreadyInUse, "Code"),
        ["ix_sku_barcode"] = (BusinessViolationCodes.BarcodeAlreadyInUse, ShopMessages.BarcodeAlreadyInUse, "Barcode"),
        ["ix_sku_price_sku_effective"] = (BusinessViolationCodes.DuplicatePriceEffectiveDate, ShopMessages.DuplicatePriceEffectiveDate, "EffectiveFrom"),
        ["ix_sourcing_origin_country"] = (BusinessViolationCodes.OriginAlreadyExists, ShopMessages.OriginAlreadyExists, "CountryCode"),
        ["ix_product_review_active_per_customer_product"] = (BusinessViolationCodes.AlreadyReviewed, ShopMessages.AlreadyReviewed, "ProductId"),
        ["ix_stock_alert_pending_per_customer_sku"] = (BusinessViolationCodes.StockAlertAlreadyRequested, ShopMessages.StockAlertAlreadyRequested, "SkuId"),
    };

    // HO-SHP-001 §12.5 -- a first-write race on a wishlist or the sales/stock copy -> 409 (no
    // sequential pre-check exists for these, since the race is the FIRST write of the id).
    private static readonly HashSet<string> ShopConflictTables = ["wishlist", "product_sales_stats"];

    // HO-IMP-001 §12.5 -- the same 400 each handler's own pre-check returns (InventoryMessages is shared, HO-ACC-001 §20.6, so the two
    // paths cannot drift). ix_stock_alert_dedup / ix_stock_alert_open_pair are swallowed by C15 and never reach here; the immutability
    // triggers are deliberately not mapped (reaching them is a bug, and a 500 is correct).
    private static readonly Dictionary<string, (string Code, string Message, string Property)> InventoryBadRequestIndexes = new()
    {
        ["ix_stock_location_branch_code"] = (BusinessViolationCodes.StockLocationCodeAlreadyExists, InventoryMessages.StockLocationCodeAlreadyExists, "Code"),
        ["ix_stock_location_one_quarantine"] = (BusinessViolationCodes.QuarantineLocationAlreadyExists, InventoryMessages.QuarantineLocationAlreadyExists, "Kind"),
        ["ix_supplier_code"] = (BusinessViolationCodes.SupplierCodeAlreadyExists, InventoryMessages.SupplierCodeAlreadyExists, "Code"),
        ["ix_stock_count_one_active"] = (BusinessViolationCodes.CountLocationBusy, InventoryMessages.CountLocationBusy, "LocationId"),
        ["ix_batch_receipt_lot"] = (BusinessViolationCodes.DuplicateReceiptLine, InventoryMessages.DuplicateReceiptLine, "Lines"),
    };

    // HO-IMP-001 §12.5 (ADR-099, ADR-101) -- a 23514 NAMES its constraint, so the race outcomes map the same way a unique index does: the
    // projection's CHECK is the last-unit control (409 InsufficientStock); the two usability-trigger refusals are 409 BatchExpired and
    // 409 BatchNotUsable. The text is InventoryMessages' -- the same the port returns when it refuses first. The immutability and position-guard
    // triggers are deliberately NOT mapped: reaching them is a bug, and a 500 is correct.
    private static readonly Dictionary<string, (string Code, string Message, string Property)> InventoryCheckConflicts = new()
    {
        ["ck_stock_position_balance"] = (BusinessViolationCodes.InsufficientStock, InventoryMessages.InsufficientStock, "Quantity"),
        ["tg_stock_batch_expired"] = (BusinessViolationCodes.BatchExpired, InventoryMessages.BatchExpiredGeneric, "BatchId"),
        ["tg_stock_batch_not_usable"] = (BusinessViolationCodes.BatchNotUsable, InventoryMessages.BatchNotUsable, "BatchId"),
    };

    // HO-IMP-001 §12.5 -- a first-write race on a storage profile (its id IS the product id) -> 409.
    private static readonly HashSet<string> InventoryConflictTables = ["product_storage_profile"];

    // HO-BIL-001 §12.5 -- messages come from BillingMessages, shared with each handler pre-check, so the sequential
    // and concurrent paths for the same rule cannot drift. ix_invoice_number / ix_invoice_sequence are deliberately
    // NOT mapped (a numbering bug must be loud, never papered over), and neither are the Billing trigger violations
    // (P0001 -- a code defect). The idempotency indexes are answered by BillingIdempotencyReplayFilter.
    private static readonly Dictionary<string, (int Status, string Code, string Message, string Property)> BillingMappings = new()
    {
        ["ix_charge_source"] = (409, BusinessViolationCodes.ChargeAlreadyRecorded, BillingMessages.ChargeAlreadyRecorded, "SourceId"),
        ["ix_invoice_line_charge"] = (409, BusinessViolationCodes.ChargeAlreadyInvoiced, BillingMessages.ChargeAlreadyInvoiced, "ChargeIds"),
        ["ix_bank_statement_source"] = (400, BusinessViolationCodes.StatementDuplicate, BillingMessages.StatementDuplicate, "SourceSha256"),
        ["ix_bank_match_line"] = (409, BusinessViolationCodes.BankLineAlreadyMatched, BillingMessages.BankLineAlreadyMatched, "StatementLineId"),
        ["ix_bank_match_payment"] = (409, BusinessViolationCodes.PaymentAlreadyMatched, BillingMessages.PaymentAlreadyMatched, "PaymentId"),
    };

    // A first-write race on a Billing row whose id is known in advance (a profile, a loyalty account) -> 409.
    private static readonly HashSet<string> BillingFirstWriteTables = ["billing_profile", "loyalty_account"];

    // HO-ORD-001 §12.5 -- messages come from OrderMessages, shared with each handler pre-check, so the sequential and concurrent paths for the
    // same rule cannot drift. Unknown constraints rethrow.
    private static readonly Dictionary<string, (int Status, string Code, string Message, string Property)> OrderingMappings = new()
    {
        ["ix_discount_code_code"] = (400, BusinessViolationCodes.DiscountCodeAlreadyExists, OrderMessages.DiscountCodeAlreadyExists, "Code"),
        ["ix_delivery_zone_name"] = (400, BusinessViolationCodes.DeliveryZoneNameAlreadyExists, OrderMessages.DeliveryZoneNameAlreadyExists, "Name"),
        ["ix_courier_name"] = (400, BusinessViolationCodes.CourierNameAlreadyExists, OrderMessages.CourierNameAlreadyExists, "Name"),
        // Two first adds raced (or two devices): the unique index kept ONE active cart; the loser retries and finds it (HO-ORD-001 §12.5).
        ["ix_cart_active_customer"] = (409, BusinessViolationCodes.DuplicateSubmission, OrderMessages.CartChangedOnAnotherDevice, "CustomerId"),
        ["ix_cart_guest_token"] = (409, BusinessViolationCodes.DuplicateSubmission, OrderMessages.CartChangedOnAnotherDevice, "GuestToken"),
        // The same checkout submitted twice in parallel with one key: the unique backstop kept ONE order; the loser is told it was already submitted (§12.5).
        ["ix_sales_order_customer_idempotency"] = (409, BusinessViolationCodes.DuplicateSubmission, OrderMessages.DuplicateSubmission, "IdempotencyKey"),
    };

    // A first-write race on the bank-transfer account's one fixed id -> 409.
    private static readonly HashSet<string> OrderingFirstWriteTables = ["bank_transfer_account"];

    private static readonly Dictionary<string, (string Code, string Message, string Property)> AdministrationBadRequestIndexes = new()
    {
        ["ix_branch_code"] = (BusinessViolationCodes.BranchCodeAlreadyExists, "This branch code is already in use.", "Code"),
        ["ix_content_item_kind_slug"] = (BusinessViolationCodes.ContentSlugAlreadyExists, "This slug is already in use.", "Slug"),
        ["ix_tax_class_code"] = (BusinessViolationCodes.ServiceCodeAlreadyExists, "This tax class code is already in use.", "Code"),
        ["ix_tax_rate_class_effective"] = (BusinessViolationCodes.DuplicatePriceEffectiveDate, "A rate already exists with this effective date.", "EffectiveFrom"),
        ["ix_policy_document_key"] = (BusinessViolationCodes.PolicyKeyAlreadyExists, "This policy key is already in use.", "Key"),
        ["ix_policy_version_key_number"] = (BusinessViolationCodes.PolicyVersionAlreadyExists, "This policy already has a version with this number.", "VersionNumber"),
        ["ex_leave_request_staff_no_overlap"] = (BusinessViolationCodes.LeaveOverlapsExistingLeave, "This period overlaps an existing leave request.", "StartsOn"),
    };

    /// <summary>MVC runs this member in preference to the synchronous <see cref="OnException"/>; no mapping needs a read (HO-P1 retired the two that did).</summary>
    public Task OnExceptionAsync(ExceptionContext context)
    {
        OnException(context);
        return Task.CompletedTask;
    }

    public void OnException(ExceptionContext context)
    {
        // HO-XCT-001 §12.5 (ADR-299): a refused hard delete -- the EF guard or the database trigger -- is 409 RecordIsRetained.
        if (TryMapRecordIsRetained(context)) return;

        // Gate fix (flaky I-C2, 2026-09-28, reproduced against a freshly migrated DB): EF Core's
        // ExecutionStrategy wraps an exception it classifies as transient -- which a Postgres
        // deadlock is -- in an outer InvalidOperationException ("likely due to a transient
        // failure") whenever retry-on-failure is not enabled (it is not, here), even though this
        // DbContext never opted into that strategy. `context.Exception is DbUpdateException` alone
        // therefore stopped matching for exactly the failure shape this filter exists to catch,
        // and the 20-concurrent-holds race fell through to the generic empty-body 500. Unwrap
        // through however many layers wrap it, rather than assuming the shape is always flat.
        if (UnwrapDbUpdateException(context.Exception) is not { InnerException: PostgresException pg }) return;

        if (pg.SqlState == PostgresErrorCodes.CheckViolation)
        {
            if (pg.ConstraintName is not null && InventoryCheckConflicts.TryGetValue(pg.ConstraintName, out var checkMapping))
            {
                context.Result = Conflict(checkMapping.Code, checkMapping.Message, checkMapping.Property, "Inventory");
                context.ExceptionHandled = true;
            }

            return;
        }

        if (pg.SqlState != PostgresErrorCodes.UniqueViolation && pg.SqlState != PostgresErrorCodes.ExclusionViolation) return;

        // Gate fix 2026-09-26 (ARCH LOW): §8.8 says accepting the same policy version twice is a
        // no-op 204, and the handler's own sequential pre-check already returns exactly that --
        // two truly concurrent accepts must agree, not have the race path return a 400
        // PolicyAlreadyAccepted the sequential path never would.
        if (pg.ConstraintName == "ix_policy_acceptance_customer_key_number")
        {
            context.Result = new NoContentResult();
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && MobileIndexes.Contains(pg.ConstraintName))
        {
            context.Result = BadRequest(BusinessViolationCodes.MobileNumberAlreadyRegistered, AccountMessages.MobileInUse, "MobileNumber", "Account");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && EmailIndexes.Contains(pg.ConstraintName))
        {
            context.Result = BadRequest(BusinessViolationCodes.EmailAddressAlreadyRegistered, AccountMessages.EmailInUse, "EmailAddress", "Account");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && AdministrationBadRequestIndexes.TryGetValue(pg.ConstraintName, out var mapping))
        {
            context.Result = BadRequest(mapping.Code, mapping.Message, mapping.Property, "Administration");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && ShopBadRequestIndexes.TryGetValue(pg.ConstraintName, out var shopMapping))
        {
            context.Result = BadRequest(shopMapping.Code, shopMapping.Message, shopMapping.Property, "Product");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && InventoryBadRequestIndexes.TryGetValue(pg.ConstraintName, out var inventoryMapping))
        {
            context.Result = BadRequest(inventoryMapping.Code, inventoryMapping.Message, inventoryMapping.Property, "Inventory");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && BillingMappings.TryGetValue(pg.ConstraintName, out var billing))
        {
            context.Result = billing.Status == 409
                ? Conflict(billing.Code, billing.Message, billing.Property, "Billing")
                : BadRequest(billing.Code, billing.Message, billing.Property, "Billing");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && OrderingMappings.TryGetValue(pg.ConstraintName, out var ordering))
        {
            context.Result = ordering.Status == 409
                ? Conflict(ordering.Code, ordering.Message, ordering.Property, "Order")
                : BadRequest(ordering.Code, ordering.Message, ordering.Property, "Order");
            context.ExceptionHandled = true;
            return;
        }

        if (pg.ConstraintName is not null && ConflictIndexes.Contains(pg.ConstraintName))
        {
            context.Result = new ConflictObjectResult(new
            {
                error = "This record was changed by someone else. Reload and try again."
            });
            context.ExceptionHandled = true;
            return;
        }

        if (pg.TableName is not null && (FirstWriteRaceTables.Contains(pg.TableName) || ShopConflictTables.Contains(pg.TableName) || InventoryConflictTables.Contains(pg.TableName) || BillingFirstWriteTables.Contains(pg.TableName) || OrderingFirstWriteTables.Contains(pg.TableName)))
        {
            context.Result = new ConflictObjectResult(new
            {
                error = "This record was changed by someone else. Reload and try again."
            });
            context.ExceptionHandled = true;
            return;
        }

        // Any other constraint -> rethrow (do nothing; ExceptionHandled stays false).
    }

    /// <summary>Walks the exception chain for the first <see cref="DbUpdateException"/>: usually
    /// <c>context.Exception</c> itself, but sometimes wrapped in an outer
    /// <see cref="InvalidOperationException"/> the base <c>ExecutionStrategy</c> adds for an
    /// exception it classifies as transient (gate fix, see <see cref="OnException"/>).</summary>
    /// <summary>HO-XCT-001 §12.5. <see cref="AmarGram.Infrastructure.Retention.ProtectedRecordDeletionException"/> (raised by the EF guard before SQL) and a
    /// Postgres <c>P0001</c> whose message starts "Hard delete of" (the retention trigger) both answer <c>409 RecordIsRetained</c> in plain language. Any other
    /// <c>P0001</c> is not handled here. Logged at Error with the table name: reaching it means some code path tried to delete a retained record.</summary>
    private static bool TryMapRecordIsRetained(ExceptionContext context)
    {
        string? table = null;
        for (var current = context.Exception; current is not null; current = current.InnerException)
        {
            if (current is AmarGram.Infrastructure.Retention.ProtectedRecordDeletionException refused)
            {
                table = $"{refused.Schema}.{refused.Table}";
                break;
            }

            if (current is PostgresException { SqlState: "P0001" } pg && pg.MessageText.StartsWith("Hard delete of", StringComparison.Ordinal))
            {
                table = pg.MessageText;
                break;
            }
        }

        if (table is null) return false;

        context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger<UniqueConstraintExceptionFilter>()
            .LogError("Refused a hard delete of a retained record ({Table}). CorrelationId: {TraceId}", table, context.HttpContext.TraceIdentifier);

        context.Result = Conflict(BusinessViolationCodes.RecordIsRetained, OperationsMessages.RecordIsRetained, "Record", "Operations");
        context.ExceptionHandled = true;
        return true;
    }

    private static DbUpdateException? UnwrapDbUpdateException(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbUpdateException dbUpdateException) return dbUpdateException;
        }

        return null;
    }

    private static BadRequestObjectResult BadRequest(string code, string message, string property, string resourceName)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: resourceName);
        return new BadRequestObjectResult(validationResponse);
    }

    private static ConflictObjectResult Conflict(string code, string message, string property, string resourceName)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(errorMessage: message, propertyName: property, errorCode: code, resourceName: resourceName);
        return new ConflictObjectResult(validationResponse);
    }
}
