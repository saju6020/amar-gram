import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import {
  ApiConflictError,
  ApiError,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiRateLimitedError,
  ApiValidationError,
  OfflineError,
} from './client';

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** HO-XCT-002 §11.3/§11.7 (ADR-FE-143) — what a refused offline write says. Nothing was lost, and
 *  nothing was queued. */
export const OFFLINE_WRITE_MESSAGE =
  "You're offline, so this couldn't be saved. Your entries are still here — try again when the connection returns.";

/**
 * Bridges the API's ValidationResponse to react-hook-form (§11.8). This is where
 * NFR-USA-4 is met or failed:
 *  - `errorMessage` is written for a human by the API and is shown as-is.
 *  - `errorCode` (e.g. "SkuCodeAlreadyInUse") is only ever read to pick an area's OWN
 *    fallback sentence from a `codeMessages` map the caller passes in (used when `errorMessage`
 *    is empty); it is never rendered. With no map the fallback is the generic sentence — no
 *    area's wording is built in here.
 *  - An error whose field isn't one of `knownFields` becomes a form-level message under `root`
 *    instead of being silently dropped — a validation failure with no visible cause is worse
 *    than a crash.
 *
 * `fieldMap` translates the API command's `propertyName` to this form's field name where they
 * differ. Keep that mapping in one table per form, not scattered across the codebase.
 */
export function applyValidationErrors<TFieldValues extends FieldValues>(
  error: ApiValidationError,
  setError: UseFormSetError<TFieldValues>,
  options: {
    fieldMap?: Partial<Record<string, Path<TFieldValues>>>;
    knownFields?: ReadonlyArray<Path<TFieldValues>>;
    codeMessages?: Readonly<Record<string, string>>;
  } = {},
): void {
  const { fieldMap = {}, knownFields, codeMessages } = options;
  const rootField = 'root' as Path<TFieldValues>;

  if (error.response.errors.length === 0) {
    setError(rootField, { type: 'server', message: 'Something went wrong. Please try again.' });
    return;
  }

  for (const validationError of error.response.errors) {
    const mapped = fieldMap[validationError.propertyName];
    const target = mapped ?? (validationError.propertyName as Path<TFieldValues>);
    const isKnown = !knownFields || knownFields.includes(target);

    setError(isKnown ? target : rootField, {
      type: 'server',
      // The server's message is preferred; the caller's mapped plain-language text is the fallback
      // when it is empty. `errorCode` is read only to pick that fallback, never shown.
      message:
        validationError.errorMessage ||
        codeMessages?.[validationError.errorCode] ||
        GENERIC_ERROR_MESSAGE,
    });
  }
}

/**
 * A form's submit handler, wrapped so every form applies §11.8 the same way instead
 * of each one re-writing its own try/catch:
 *  - `ApiValidationError` → `applyValidationErrors` (field-level, or `root` when unmapped).
 *  - `ApiConflictError` (a `409`, a concurrent edit) → a `root` message asking the
 *    user to get the latest version and try again — component test E20's "user is told the
 *    record changed", **never a silent overwrite**. The caller's field values are untouched
 *    either way, since nothing here resets the form (NFR-USA-5).
 *  - anything else (network failure, `5xx`) → a plain-language `root` message, never the raw
 *    error (NFR-USA-4, E21).
 *
 * Returns the action's result on success, or `undefined` after recording the error — callers
 * that need to react to success (closing a dialog, navigating) check for that.
 */
export async function submitWithServerErrors<TFieldValues extends FieldValues, TResult>(
  action: () => Promise<TResult>,
  setError: UseFormSetError<TFieldValues>,
  options: {
    fieldMap?: Partial<Record<string, Path<TFieldValues>>>;
    knownFields?: ReadonlyArray<Path<TFieldValues>>;
    codeMessages?: Readonly<Record<string, string>>;
  } = {},
): Promise<TResult | undefined> {
  try {
    return await action();
  } catch (error) {
    const rootField = 'root' as Path<TFieldValues>;
    if (error instanceof OfflineError) {
      setError(rootField, { type: 'server', message: OFFLINE_WRITE_MESSAGE });
    } else if (error instanceof ApiValidationError) {
      applyValidationErrors(error, setError, options);
    } else if (error instanceof ApiConflictError) {
      setError(rootField, {
        type: 'server',
        message:
          'Someone else changed this record while you were editing it. Get the latest version, then try saving again — your entered changes are still here.',
      });
    } else {
      setError(rootField, { type: 'server', message: describeUnexpectedError(error) });
    }
    return undefined;
  }
}

/**
 * `applyValidationErrors`/`submitWithServerErrors` both need a react-hook-form `setError` —
 * fine for most forms, but a screen that isn't a react-hook-form form at all
 * (a plain controlled input plus a button click, not a `<form onSubmit>`) needs another route. This is the same
 * §11.8 mapping for that case: every error shown (never just `errors[0]` — "must never be
 * swallowed" applies here too), a `409` gets its own message, and `errorCode` is only read to
 * pick a fallback from the caller's optional `codeMessages` (never rendered). Returns one display string rather than setting per-field state, since the caller
 * (the photos page's inline alert) only has one error slot to show.
 */
export function describeApiError(
  error: unknown,
  codeMessages?: Readonly<Record<string, string>>,
): string {
  if (error instanceof OfflineError) return OFFLINE_WRITE_MESSAGE;
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  if (error instanceof ApiValidationError) {
    if (error.response.errors.length === 0) {
      return 'Something went wrong. Please try again.';
    }
    return error.response.errors
      .map(
        (validationError) =>
          validationError.errorMessage ||
          codeMessages?.[validationError.errorCode] ||
          GENERIC_ERROR_MESSAGE,
      )
      .join(' ');
  }
  if (error instanceof ApiConflictError) {
    return 'Someone else changed this record while you were working. Reload and try again.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * HO-ADM-002 §18 A3 — a server `403` on a save/action is shown as a clear permission message, never
 * the generic "Something went wrong. Please try again." (retrying a refusal cannot help). Names no
 * role and no action, like `PermissionDeniedState` (ADR-FE-009); the two branch-assignment codes
 * (§11.9) get their own wording because they mean "pick or get assigned a branch", not "never".
 */
export const PERMISSION_DENIED_MESSAGE =
  "You don't have permission to do this. Ask an administrator if you need access.";

function describeForbidden(error: ApiForbiddenError): string {
  const code = error.body.errors?.[0]?.errorCode;
  if (code === 'BranchNotAssigned') {
    return "You aren't assigned to the active branch. Choose one of your branches from the branch picker.";
  }
  if (code === 'BranchAssignmentRequired') {
    return 'Ask an administrator to assign you to a branch.';
  }
  return PERMISSION_DENIED_MESSAGE;
}

/** The root message for a submit that failed with anything other than a `400`: a permission
 *  message for a `403`, otherwise the generic plain-language retry text (NFR-USA-4). */
export function describeUnexpectedError(error: unknown): string {
  if (error instanceof OfflineError) return OFFLINE_WRITE_MESSAGE;
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  return 'Something went wrong. Please try again.';
}

/**
 * HO-ADM-002 §11.9 — `BranchNotAssigned` (a stale/refused `X-Branch-Id`) and
 * `BranchAssignmentRequired` (no assignment, and more than one active branch exists) are the two
 * `403` codes every branch-scoped admin page can hit even for a role that otherwise holds the
 * action — they mean "pick or get assigned a branch", not "you may never do this". Callers show a
 * banner with a link to the branch picker (`BranchNotAssigned`) or the plain-language ask-an-
 * administrator text (`BranchAssignmentRequired`) instead of falling through to the generic
 * `PermissionDeniedState`, which would wrongly suggest the action itself is forbidden.
 */
export type BranchAssignmentErrorCode = 'BranchNotAssigned' | 'BranchAssignmentRequired';

export function getBranchAssignmentErrorCode(error: unknown): BranchAssignmentErrorCode | null {
  if (!(error instanceof ApiForbiddenError)) return null;
  const code = error.body.errors?.[0]?.errorCode;
  return code === 'BranchNotAssigned' || code === 'BranchAssignmentRequired' ? code : null;
}

// -------------------------------------------------------------------------------------------
// HO-NTF-002 §11.6 — Notifications. `errorCode` is read here only to CHOOSE a plain-language
// sentence; it is never rendered (NFR-USA-4).
// -------------------------------------------------------------------------------------------

export type TemplateContentField = 'subject' | 'title' | 'body' | 'linkPath';

/**
 * C1 / preview violations name their field as `Contents[i].Subject | Title | Body | LinkPath`
 * (HO-NTF-001 §8.2 rule 3). `i` indexes the `contents` array the client SENT, so the caller maps
 * the index back to a channel tab. `Contents` on its own (no index) has no field and returns null.
 */
export function parseTemplateContentsProperty(
  propertyName: string,
): { index: number; field: TemplateContentField } | null {
  const match = /^Contents\[(\d+)\]\.(Subject|Title|Body|LinkPath)$/i.exec(propertyName);
  if (!match) return null;
  const field = match[2]!;
  return {
    index: Number(match[1]),
    field: (field.charAt(0).toLowerCase() + field.slice(1)) as TemplateContentField,
  };
}

/** C8 (preferences) `PreferredChannel`, C7 (resend) `Channel` -> the form field of the same meaning. */
export const PREFERRED_CHANNEL_FIELD_MAP = { PreferredChannel: 'preferredChannel' } as const;
export const RESEND_FIELD_MAP = { Channel: 'channel' } as const;

export const TEMPLATE_CONFLICT_MESSAGE =
  'Someone else changed this template. Reload to see their version.';

function firstErrorCode(error: ApiValidationError): string | undefined {
  return error.response?.errors?.[0]?.errorCode;
}

/** A resend that the server refused (C7), as one plain sentence. `null` when it is not one of the
 *  three resend-specific refusals, so the caller falls back to `describeApiError`. */
export function describeResendRefusal(error: unknown): string | null {
  if (!(error instanceof ApiValidationError)) return null;
  const code = firstErrorCode(error);
  if (code === 'ResendLimitReached') return 'This message has already been resent 3 times.';
  if (code === 'ResendChannelNotAvailable') {
    return "That channel isn't available for this message. Choose another one.";
  }
  if (code === 'NotificationCannotBeResent') {
    // The API writes this sentence for a person (it names the reason) — shown as-is.
    return error.response.errors[0]?.errorMessage ?? "This message can't be resent right now.";
  }
  return null;
}

export const INVALID_UNSUBSCRIBE_LINK_MESSAGE =
  "This link isn't valid any more. You can manage your preferences after signing in.";
export const UNSUBSCRIBE_RATE_LIMITED_MESSAGE =
  'Too many attempts. Please wait a minute and try again.';

export function isInvalidUnsubscribeLink(error: unknown): boolean {
  return error instanceof ApiValidationError && firstErrorCode(error) === 'InvalidUnsubscribeLink';
}

/**
 * HO-SHP-002 §11.7 — HO-SHP-001 §10.4 codes mapped to the plain-language messages used in the shop
 * screens. The server's own message is always preferred when present; this is the fallback
 * (NFR-USA-4: the code itself is never rendered, only the text it selects).
 */
export const SHOP_CODE_MESSAGES: Readonly<Record<string, string>> = {
  ProductNotPublishable: "This product can't be published yet. Fix the items marked below.",
  SlugAlreadyInUse: 'This web address is already used by another product.',
  SlugLockedAfterPublication: "The web address can't change once a product has been published.",
  SkuCodeAlreadyInUse: 'This SKU code is already in use.',
  BarcodeAlreadyInUse: 'This barcode is already used by another SKU.',
  InvalidBarcode: 'This barcode is not valid.',
  InvalidShippingWeight: 'Enter a shipping weight between 1 and 100000 g.',
  DuplicateVariant: 'A SKU with the same size, flavour and colour already exists.',
  VariantAttributesRequired: 'Add at least a size or weight, a flavour or a colour.',
  ImageAltTextRequired: 'Describe every image in a short alt text.',
  CountryOfOriginRequired: 'Add the country of origin before publishing this food product.',
  InvalidGuaranteedAnalysis: 'Enter all four analysis values, each between 0 and 100 %.',
  PriceCannotBeBackdated: "A new price can't start in the past.",
  PriceMustBePositive: 'The price must be more than zero.',
  InvalidBundleComponent:
    "This item can't be part of a kit. Kits can't contain other kits.",
  ReviewNotPermitted: 'Only customers who bought this product can review it.',
  AlreadyReviewed: 'You have already reviewed this product.',
  SkuAlreadyAvailable: 'This size is in stock again — you can buy it now.',
  StockAlertAlreadyRequested: 'You already have a pending alert for this item.',
  PurchaseNotPermitted: "This item can't be bought, so we can't set an alert for it.",
  LocaleNotEnabled: 'That language is not enabled for the shop.',
  InvalidCatalogueFilter: 'One of the filters is not valid. Clear the filters and try again.',
};

/** Every HO-SHP-001 command `propertyName` (PascalCase on the wire). `SHOP_FIELD_MAP` maps each to
 *  the lower-camel form field of the same name, so a section form passes one shared table. */
export const SHOP_PROPERTY_NAMES = [
  'Name',
  'Brand',
  'Description',
  'Category',
  'Subcategory',
  'Tags',
  'TaxClassId',
  'CountryOfOriginCode',
  'ListedOnStorefront',
  'IsExpiryTracked',
  'HealthFocus',
  'Slug',
  'Kind',
  'BundleSkuCode',
  'Code',
  'Barcode',
  'SizeOrWeight',
  'Flavour',
  'Colour',
  'PackQuantity',
  'Manufacturer',
  'LifeStage',
  'ProteinSource',
  'IngredientList',
  'GuaranteedAnalysis',
  'ProteinPercent',
  'FatPercent',
  'FibrePercent',
  'MoisturePercent',
  'FeedingGuide',
  'StorageInstructions',
  'Images',
  'FileId',
  'AltText',
  'Components',
  'ComponentSkuId',
  'Quantity',
  'Links',
  'RelatedProductId',
  'Locale',
  'Amount',
  'CurrencyCode',
  'EffectiveFrom',
  'CountryCode',
  'SourcingNotes',
  'IsFeatured',
  'SortOrder',
  'Rating',
  'Title',
  'Body',
  'SkuId',
  'ProductId',
  'Reason',
  'Note',
] as const;

export const SHOP_FIELD_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  SHOP_PROPERTY_NAMES.map((name) => [name, name.charAt(0).toLowerCase() + name.slice(1)]),
);

// ---------------------------------------------------------------------------------------------
// HO-BIL-002 §11.12 — Billing. HO-BIL-001 §10.4 codes mapped to the plain-language messages the
// screens use. The server's own message is ALWAYS preferred (it names amounts: "Only BDT 400.00 is
// outstanding on INV-…"); this table is the fallback when it is empty. `errorCode` is read to pick
// a sentence or to drive behaviour (never rendered). A message about a card number never carries
// the value: the server refuses it without echoing it, and nothing here puts it back.
// ---------------------------------------------------------------------------------------------

export const BILLING_CODE_MESSAGES: Readonly<Record<string, string>> = {
  CurrencyMismatch: 'These amounts are not in the same currency.',
  ChargeNotFound: 'That charge could not be found.',
  ChargeAlreadyRecorded: 'This charge has already been recorded.',
  ChargeAlreadyInvoiced: 'This charge is already on an invoice.',
  ChargeNotActive: 'That charge has been voided.',
  ChargesMixedCustomerOrBranch:
    'Charges on one invoice must belong to the same customer and branch.',
  TaxClassNotFound: 'That tax class could not be found.',
  TaxRateNotConfigured: 'A tax class used here has no rate configured. Set a rate before issuing.',
  InvalidQuantity: 'Enter a quantity above zero.',
  DiscountExceedsAmount: 'The discount is more than the amount.',
  InvoiceNotFound: 'That invoice could not be found.',
  InvoiceNotDraft:
    'Only a draft invoice can be changed. Issued invoices are corrected with a credit note.',
  InvoiceTooManyLines: 'This invoice has too many lines. Split it into two invoices.',
  BillingProfileMissing:
    'This branch has no billing profile yet. An administrator must set one before invoices can be issued.',
  FinancialYearConfigurationChanged: 'The financial year setting changed. Reload and try again.',
  AllocationExceedsOutstanding: 'That is more than is outstanding on the invoice.',
  AllocationExceedsUnallocated: 'That is more than is left unallocated on this payment.',
  EarmarkMismatch: 'This deposit is set aside for something else.',
  PaymentNotFound: 'That payment could not be found.',
  PaymentNotAccepted: 'Only an accepted payment can be changed this way.',
  PaymentNotPending: 'This payment is no longer waiting for approval.',
  ApproverMustDiffer:
    'A payment must be approved by a different staff member than the one who recorded it.',
  ReferenceRequired: 'Enter the reference for this payment method.',
  CollectorRequired: 'Choose who collected this payment.',
  ReferenceLooksLikeCardNumber:
    'This looks like a card number. Enter the terminal slip number instead — card numbers must never be recorded.',
  ReceivedDateInFuture: 'The date received cannot be in the future.',
  ReceivedDateTooOld: 'The date received is too far in the past.',
  PaymentHasRefunds: 'A payment that has been refunded cannot be reversed.',
  ReasonRequired: 'Enter a reason.',
  CreditExceedsInvoice: 'The credit is more than what remains on the invoice.',
  CreditExceedsLine: 'The credit is more than what remains on that line.',
  CreditNoteNotFound: 'That credit note could not be found.',
  RefundMethodNotAllowed: 'That refund method is not allowed for this payment.',
  RefundExceedsAvailable: 'That is more than is available to refund on this payment.',
  CashUpClosed: 'This day has been closed and can no longer be changed.',
  CashUpDateInFuture: 'You cannot count the till for a future day.',
  CountRequired: 'Count the cash before closing the day.',
  VarianceExplanationRequired:
    'The counted cash differs from the expected cash. Enter an explanation before closing.',
  PendingApprovalsExist:
    'Payments recorded for this day are still waiting for approval. Approve or reject them before closing.',
  CollectionNotCod: 'That payment is not a cash-on-delivery collection.',
  CollectionCourierMismatch: 'That collection belongs to a different courier.',
  RemittanceExceedsCollection: 'The amount remitted is more than was collected.',
  StatementDuplicate: 'This statement file has already been imported for this account.',
  StatementTooLarge: 'The statement file is larger than 1 MiB.',
  StatementMalformed: 'The statement file could not be read.',
  StatementLineNotFound: 'That statement line could not be found.',
  BankLineAlreadyMatched: 'This statement line is already matched to a payment.',
  PaymentAlreadyMatched: 'This payment is already matched to a statement line.',
  MatchAmountMismatch: 'The statement line and the payment are not the same amount.',
  MatchMethodNotTransfer: 'Only a bank transfer payment can be matched to a statement line.',
  ExportRangeTooLarge: 'An export can cover at most 366 days. Choose a shorter range.',
  LoyaltyNotEnabled: 'Loyalty points are not enabled.',
  LoyaltyInsufficientPoints: 'The customer does not have that many points.',
  LoyaltyBelowMinimum: 'That is below the minimum number of points that can be redeemed.',
  LoyaltyRedemptionExceedsNet: 'The points are worth more than the invoice.',
  IdempotencyKeyConflict:
    'This form was already used for a different request. Start again from the beginning.',
  StaleVersion: 'This record changed while you were working. It has been reloaded.',
};

/** `Allocations[0].Amount` → `amount`; `Collector.CourierCode` → `courierCode`; `ExternalReference`
 *  → `externalReference`; a camelCase parameter name (`countedCash`) is kept — the form field names
 *  Billing forms register. */
export function billingPropertyName(propertyName: string): string {
  const last = propertyName.includes('.')
    ? propertyName.slice(propertyName.lastIndexOf('.') + 1)
    : propertyName;
  const base = last.replace(/\[\d+\]/g, '');
  if (base.length === 0) return propertyName;
  return base.charAt(0).toLowerCase() + base.slice(1);
}

/** Every violation code of a `400`/`409`, for BEHAVIOUR only (never rendered). */
export function billingViolationCodes(error: unknown): string[] {
  const response =
    error instanceof ApiValidationError
      ? error.response
      : error instanceof ApiConflictError
        ? error.response
        : undefined;
  return response?.errors.map((violation) => violation.errorCode) ?? [];
}

/** The server's message(s) for a `400`/`409`, else the mapped fallback, else null. */
function billingServerMessage(error: unknown): string | null {
  const response =
    error instanceof ApiValidationError
      ? error.response
      : error instanceof ApiConflictError
        ? error.response
        : undefined;
  if (!response || response.errors.length === 0) return null;
  const parts = response.errors
    .map((violation) => violation.errorMessage || BILLING_CODE_MESSAGES[violation.errorCode] || '')
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** One plain-language sentence for a failed Billing request (a stale write reads as a reload). */
export function describeBillingError(error: unknown): string {
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  if (error instanceof ApiConflictError && !billingServerMessage(error)) {
    return BILLING_CODE_MESSAGES.StaleVersion ?? GENERIC_ERROR_MESSAGE;
  }
  return billingServerMessage(error) ?? GENERIC_ERROR_MESSAGE;
}

/**
 * `submitWithServerErrors` for Billing forms: a `400`'s `propertyName`s are normalised
 * (`billingPropertyName`) onto the form's own field names, an unmapped one lands on `root`; a `409`
 * reads as the server's message (or the stale-record sentence); everything else is the generic text.
 * Field values are never reset (NFR-USA-5).
 */
export async function submitBillingForm<TFieldValues extends FieldValues, TResult>(
  action: () => Promise<TResult>,
  setError: UseFormSetError<TFieldValues>,
  options: { knownFields?: ReadonlyArray<Path<TFieldValues>> } = {},
): Promise<TResult | undefined> {
  try {
    return await action();
  } catch (error) {
    const rootField = 'root' as Path<TFieldValues>;
    if (error instanceof ApiValidationError) {
      const fieldMap: Partial<Record<string, Path<TFieldValues>>> = {};
      for (const violation of error.response.errors) {
        fieldMap[violation.propertyName] = billingPropertyName(
          violation.propertyName,
        ) as Path<TFieldValues>;
      }
      applyValidationErrors(error, setError, {
        fieldMap,
        knownFields: options.knownFields,
        codeMessages: BILLING_CODE_MESSAGES,
      });
    } else {
      setError(rootField, { type: 'server', message: describeBillingError(error) });
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// HO-IMP-002 §11.9 — Imports, batches and inventory. HO-IMP-001 §10.4 codes -> the plain-language
// wording used on the screens. The SERVER'S message is preferred when present (it names the lot,
// the outstanding quantity, the location); the text below is the fallback. `errorCode` is read
// only to pick that fallback and to branch behaviour — it is never rendered (NFR-USA-4).
// ---------------------------------------------------------------------------------------------

export const INVENTORY_CODE_MESSAGES: Readonly<Record<string, string>> = {
  InsufficientStock:
    "There isn't enough stock left — someone may have just taken it. Refresh and try again.",
  BatchExpired:
    'This batch has expired and cannot be sold or used. There is no override.',
  BatchNotUsable: 'This batch cannot be used in its current state.',
  ExpiryDateRequired: 'Food and medicine must be received with an expiry date.',
  BatchAlreadyExpired: 'This stock has already expired — reject it instead of accepting it.',
  AllocationOverrideReasonRequired: "You're not taking the soonest-expiring batch. Please say why.",
  ReceiptExceedsOutstanding: "That's more than the purchase order still expects.",
  ApproverMustDiffer: 'Someone else has to approve your request.',
  CountLocationBusy: 'A count is already open at this location.',
  RecallConfirmationMismatch: "The lot number you typed doesn't match.",
  RecallStockStillHeld: 'Write off or return the remaining stock first.',
  ConsignmentNotCleared:
    'The consignment must clear customs before goods can be received against it.',
  MovementNotPermittedAtLocation: "That movement isn't allowed at that location.",
  ConsignmentVersionConflict: 'Someone else changed these costs — reload.',
  ClearanceDocumentsMissing:
    'Customs clearance needs the import permit, health certificate and customs declaration numbers.',
  StockLocationHasStock: 'This location still holds stock. Move or write it off first.',
  StockLocationNotFound:
    'That location could not be used. A write-off needs you to be assigned to every branch that holds the batch.',
  PurchaseOrderHasReceipts:
    "This order already has receipts, so it can't be cancelled. Close it short instead.",
  FractionalQuantityNotAllowed: 'This item is counted in whole units — no decimals.',
  InvalidTemperatureRange: 'The minimum temperature must be lower than the maximum.',
  TransferLocationsMustDiffer: 'Choose two different locations.',
  SupplierCodeAlreadyExists: 'This supplier code is already in use.',
  StockLocationCodeAlreadyExists: 'A location with this code already exists at this branch.',
  NoReceivedQuantityToAllocate:
    'Nothing has been received on this consignment yet, so there is nothing to allocate costs across.',
  ExchangeRateMissing: 'Add an exchange rate for every currency used in the costs.',
  RejectionReasonRequired: 'Say why the rejected quantity was rejected.',
  LotNumberRequired: 'Enter the lot number.',
  UnitCostRequired: 'Enter the unit cost.',
  DuplicateReceiptLine: 'The same SKU, lot and expiry cannot appear twice in one receipt.',
  AdjustmentNoteRequired: 'A note is required.',
  AdjustmentReasonRequired: 'Choose a reason.',
  CloseReasonRequired: 'Give a reason for closing the order short.',
  ExpectedDeliveryInPast: 'The expected delivery date cannot be in the past.',
  InvalidHsCode: 'An HS code is four digits followed by up to three groups of two.',
  InvalidCurrencyCode: 'That is not a valid currency code.',
  InvalidCountryCode: 'That is not a valid country.',
};

/** Every violation of a `400`/`409`, as plain text, in order. */
export function inventoryViolations(
  error: unknown,
): Array<{ propertyName: string; errorCode: string; message: string }> {
  const response =
    error instanceof ApiValidationError
      ? error.response
      : error instanceof ApiConflictError
        ? error.response
        : undefined;
  return (response?.errors ?? []).map((violation) => ({
    propertyName: violation.propertyName,
    errorCode: violation.errorCode,
    message:
      violation.errorMessage ||
      INVENTORY_CODE_MESSAGES[violation.errorCode] ||
      GENERIC_ERROR_MESSAGE,
  }));
}

/** One sentence for an Inventory failure. A `409` without a usable body is a stale record. */
export function describeInventoryError(error: unknown): string {
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  const violations = inventoryViolations(error);
  if (violations.length > 0) return violations.map((v) => v.message).join(' ');
  if (error instanceof ApiConflictError) {
    return 'Someone else changed this record while you were working. Reload and try again.';
  }
  return GENERIC_ERROR_MESSAGE;
}

/** True when the first violation carries `code` (behaviour only — the code is never shown). */
export function hasViolationCode(error: unknown, code: string): boolean {
  return inventoryViolations(error).some((violation) => violation.errorCode === code);
}

/** `RecallStockStillHeld` etc. may be mapped with a quantity the server named; the server's own
 *  message is used as written. This helper only lower-camels a PascalCase `propertyName`. */
export function toFieldName(propertyName: string): string {
  return propertyName.charAt(0).toLowerCase() + propertyName.slice(1);
}

/**
 * A line violation is named `Lines[i].Field` (receipt, PO, transfer, adjustment) or
 * `CostComponents[i].Amount`. Returns the index and the lower-camel field, or `null` when the name
 * is not an indexed one.
 */
export function parseIndexedProperty(
  propertyName: string,
): { collection: string; index: number; field: string } | null {
  const match = /^(\w+)\[(\d+)\](?:\.(\w+))?$/.exec(propertyName);
  if (!match) return null;
  return {
    collection: toFieldName(match[1]!),
    index: parseInt(match[2]!, 10),
    field: match[3] ? toFieldName(match[3]) : '',
  };
}

// ---------------------------------------------------------------------------------------------
// HO-ORD-002 §11.13 — Cart, checkout and orders. HO-ORD-001 §10.4 codes -> the plain-language
// fallback used when the server sent no message. The SERVER'S message is always preferred (it names
// the product, the amount, the batch); `errorCode` is read here only to pick a fallback and to
// branch behaviour — it is never rendered (NFR-USA-4). Checked against `BusinessViolationCodes` and
// `OrderingResults` in `src/`.
// ---------------------------------------------------------------------------------------------

export const ORDER_CODE_MESSAGES: Readonly<Record<string, string>> = {
  // cart
  CartFull: 'Your cart is full. Remove something before adding more.',
  SkuNotPurchasable: "This item can't be bought right now.",
  SkuUnavailable: "This item isn't available right now.",
  QuantityOutOfRange: 'Choose a smaller quantity.',
  // checkout
  CheckoutQuoteChanged:
    'Something changed while you were checking out — please review and place the order again.',
  StockNoLongerAvailable:
    'An item has just sold out. It has been removed from your order — please review and place it again.',
  CartEmpty: 'Your cart is empty.',
  NothingToPlace: 'There is nothing left in your cart that can be ordered.',
  PolicyAcceptanceRequired: 'Please read and accept our updated policies before placing your order.',
  DeliveryAddressNotFound: 'Choose a delivery address.',
  AddressOutsideServedZones: "We don't deliver to that address yet. You can collect your order instead.",
  ServiceLevelUnavailable: "That delivery option isn't available. Choose another.",
  DeliverySlotUnavailable: "That delivery time isn't available. Choose another.",
  PickupBranchUnavailable: "That branch isn't available for collection. Choose another.",
  PaymentMethodUnavailable: "That payment method isn't available for this order.",
  RecipientPhoneRequired: 'Enter a phone number for the person receiving the order.',
  DeliveryTaxNotConfigured:
    'Delivery is temporarily unavailable. Please choose collection from a branch, or try again later.',
  DuplicateSubmission: 'This order has already been placed.',
  IdempotencyKeyRequired: 'Something went wrong sending that. Please try again.',
  IdempotencyKeyReused: 'That looked like a different request — please start again.',
  RequestInProgress: 'This is already being processed.',
  // discounts
  DiscountCodeNotFound: "We don't recognise that code.",
  DiscountCodeInactive: 'That code is not active.',
  DiscountCodeNotYetValid: "That code isn't valid yet.",
  DiscountCodeExpired: 'That code has expired.',
  DiscountUsageLimitReached: 'That code has been used up.',
  DiscountCustomerLimitReached: "You've already used that code the maximum number of times.",
  DiscountFirstOrderOnly: 'That code is for first orders only.',
  DiscountNotApplicableToItems: "That code doesn't apply to the items in your order.",
  DiscountMinimumSpendNotMet: "Your order doesn't reach the minimum spend for that code.",
  DiscountCodeAlreadyExists: 'A code with this name already exists.',
  InvalidDiscountDefinition: 'Check the discount settings.',
  // order lifecycle
  OrderNotFound: 'This order could not be found.',
  InvalidOrderTransition: "That isn't possible for an order in its current state.",
  CancellationNotAvailable:
    "This order can't be cancelled online any more. Please contact the shop.",
  CancellationReasonRequired: 'Enter a reason for cancelling.',
  OrderNotAwaitingPayment: 'This order is not waiting for a payment.',
  OrderNotExpirable: 'This order cannot expire.',
  TransferAmountMismatch: "The amount doesn't match the order total.",
  PaymentAlreadyAwaitingApproval: 'A payment for this order is already waiting for approval.',
  NoPaymentAwaitingApproval: 'No payment is waiting for approval on this order.',
  SecondApproverMustDiffer: 'Someone else must approve a payment you recorded.',
  ApproverMustDiffer: 'Someone else must approve a payment you recorded.',
  PaymentNotPending: 'That payment is no longer waiting for approval.',
  OrderNotFullyAllocated: "This order's items are not all allocated to stock yet.",
  BatchRecalled: 'A batch on this order has been recalled. Reallocate that line first.',
  BatchExpired: 'A batch on this order has expired. Reallocate that line first.',
  CourierNotFound: 'Choose a courier.',
  CodCollectionRequired: 'Record the cash collected on delivery.',
  CollectionPaymentMismatch: "The amount doesn't match what is still to pay.",
  TerminalReferenceRequired: 'Enter the terminal slip number for a card payment.',
  DeliveryFailureReasonInvalid: "That reason doesn't apply to this order.",
  TendersDoNotCoverTotal: "The payments entered don't cover the total yet.",
  ReallocationReasonRequired: 'Enter a reason for moving this line to another batch.',
  AccountNotActive: "This customer's account is closed, so a sale can't be recorded against it.",
  StaleVersion: 'This order changed while you were working. It has been reloaded.',
  // returns and refunds
  ReturnNotFound: 'This return could not be found.',
  ReturnWindowClosed: 'The return window for this order has closed.',
  ReturnQuantityExceeded: 'You can return at most the quantity you bought.',
  ReturnNotEligibleOpenedFood:
    "Opened food can only be returned if there's a quality problem or a recall.",
  ReturnNotEligibleUsedItem: 'Used household and care items cannot be returned unless faulty or recalled.',
  DefectConfirmationRequired: 'Confirm the defect, with a note, on every line that needs it.',
  InvalidReturnTransition: "That isn't possible for a return in its current state.",
  ReturnReceiptExceedsApproved: "You can't receive more than was approved.",
  RefundExceedsAmountPaid: "That's more than can still be refunded.",
  RefundMethodNotAllowed: "That refund method isn't allowed for how this order was paid.",
  RefundMethodUnavailable: "Store credit isn't available yet.",
  RefundReferenceRequired: 'Enter the reference for this refund.',
  // configuration
  DeliveryZoneNotFound: 'This delivery zone could not be found.',
  DeliveryZoneNameAlreadyExists: 'A delivery zone with this name already exists.',
  InvalidDeliveryZone: 'Check the delivery zone settings.',
  CourierNameAlreadyExists: 'A courier with this name already exists.',
  InvalidBankTransferAccount: 'Check the bank account details.',
  ReconciliationIssueNotFound: 'This issue could not be found.',
};

/** Quote `blockingReasons[]` -> why Place order is disabled (codes are never rendered). */
export function describeBlockingReason(code: string): string {
  return ORDER_CODE_MESSAGES[code] ?? 'This order cannot be placed yet.';
}

/** A merge `droppedLines[].reason` or re-order `unavailable[].reason` code -> a sentence fragment. */
export function describeDroppedReason(code: string): string {
  switch (code) {
    case 'CartFull':
      return 'your cart was full';
    case 'NotPurchasable':
      return 'no longer sold';
    case 'OutOfStock':
      return 'out of stock';
    default:
      return 'not available';
  }
}

/** A refunds-due `reasons[]` code -> a short label. */
export function describeRefundReason(code: string): string {
  if (code === 'MoneyOwedBack') return 'Money owed back';
  if (code === 'ReturnReceived') return 'Return received';
  return 'Refund due';
}

/** An excluded quote line's `reasonCode` -> a short label shown beside the product. */
export function describeExcludedReason(code: string): string {
  switch (code) {
    case 'NowUnavailable':
      return 'No longer available';
    case 'TaxRateNotConfigured':
      return 'Cannot be priced right now';
    default:
      return 'Left out of this order';
  }
}

/** The violations of a `400`/`409`, in order. */
function orderingViolations(error: unknown): Array<{ code: string; message: string; property: string }> {
  const response =
    error instanceof ApiValidationError
      ? error.response
      : error instanceof ApiConflictError
        ? error.response
        : undefined;
  return (
    response?.errors.map((violation) => ({
      code: violation.errorCode,
      message: violation.errorMessage || ORDER_CODE_MESSAGES[violation.errorCode] || '',
      property: violation.propertyName,
    })) ?? []
  );
}

/** Every violation code of a failed Ordering request, for BEHAVIOUR only (never rendered). */
export function orderingViolationCodes(error: unknown): string[] {
  return orderingViolations(error).map((violation) => violation.code);
}

export function hasOrderingCode(error: unknown, code: string): boolean {
  return orderingViolationCodes(error).includes(code);
}

/** `422 IdempotencyKeyReused` arrives as a bare `ApiError` (`client.ts` maps only 400/404/409/…). */
export function isIdempotencyKeyReused(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422;
}

/**
 * Should the Idempotency-Key be thrown away after this failure? The API stores and replays EVERY response below
 * 500 for a key (`IdempotencyFilter`), so after a definitive refusal whose cause lies outside the payload (a policy
 * accepted, a batch restocked, an account reactivated...) the same key with the same body would replay the stale
 * refusal. Keep the key only when no definitive answer arrived: a network failure, a 5xx, or
 * `409 RequestInProgress` (the original attempt is still running - the same key replays its result).
 */
export function shouldRenewIdempotencyKey(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status < 400 || error.status >= 500) return false;
  return !orderingViolationCodes(error).includes('RequestInProgress');
}

/** One plain-language sentence for a failed Ordering request. A `403` reads as a permission message. */
export function describeOrderingError(error: unknown): string {
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  if (isIdempotencyKeyReused(error)) return ORDER_CODE_MESSAGES.IdempotencyKeyReused ?? GENERIC_ERROR_MESSAGE;
  const messages = orderingViolations(error)
    .map((violation) => violation.message)
    .filter(Boolean);
  if (messages.length > 0) return messages.join(' ');
  if (error instanceof ApiConflictError) return ORDER_CODE_MESSAGES.StaleVersion ?? GENERIC_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

/** `Lines[2].Quantity` -> `{ index: 2, field: 'quantity' }`; used for per-line return errors (`lines[i]`). */
export function parseLineProperty(propertyName: string): { index: number; field: string } | null {
  const match = /^lines\[(\d+)\](?:\.(\w+))?$/i.exec(propertyName);
  if (!match) return null;
  const field = match[2] ?? '';
  return { index: parseInt(match[1]!, 10), field: field ? toFieldName(field) : '' };
}

/**
 * `submitWithServerErrors` for Ordering forms: a `400`'s `propertyName`s are lower-camelled onto the
 * form's own field names (`ReceivedOn` -> `receivedOn`, `Collector.CourierCode` -> `courierCode`), an
 * unmapped one lands on `root`; any other failure reads as one sentence on `root`. Field values are
 * never reset (NFR-USA-5).
 */
export async function submitOrderingForm<TFieldValues extends FieldValues, TResult>(
  action: () => Promise<TResult>,
  setError: UseFormSetError<TFieldValues>,
  options: {
    knownFields?: ReadonlyArray<Path<TFieldValues>>;
    fieldMap?: Partial<Record<string, Path<TFieldValues>>>;
  } = {},
): Promise<TResult | undefined> {
  try {
    return await action();
  } catch (error) {
    const rootField = 'root' as Path<TFieldValues>;
    if (error instanceof ApiValidationError && error.response.errors.length > 0) {
      const fieldMap: Partial<Record<string, Path<TFieldValues>>> = {};
      for (const violation of error.response.errors) {
        fieldMap[violation.propertyName] =
          options.fieldMap?.[violation.propertyName] ??
          (billingPropertyName(violation.propertyName) as Path<TFieldValues>);
      }
      applyValidationErrors(error, setError, {
        fieldMap,
        knownFields: options.knownFields,
        codeMessages: ORDER_CODE_MESSAGES,
      });
    } else {
      setError(rootField, { type: 'server', message: describeOrderingError(error) });
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// HO-POR-002 — the portal's re-order (Orders' endpoint) and its result reasons. Appended.
// ---------------------------------------------------------------------------------------------

/** Plain-language text for the `reason` code Orders puts on each line it could not add
 *  (`ReorderCommandHandler`). The set is open — a domain rule code can appear — so an unknown
 *  code gets the generic sentence and is never shown (NFR-USA-4). */
const REORDER_REASON_LABELS: Readonly<Record<string, string>> = {
  NotPurchasable: 'No longer sold.',
  OutOfStock: 'Out of stock right now.',
  CartFull:
    'Your basket already holds the most different items it can. Remove something to add this.',
  QuantityOutOfRange: 'The quantity is not allowed in one order. Add it from the product page.',
};

export const REORDER_REASON_FALLBACK = 'This could not be added to your basket.';

export function describeReorderReason(reason: string): string {
  return REORDER_REASON_LABELS[reason] ?? REORDER_REASON_FALLBACK;
}

/** One title and one sentence for a failed re-order request: `404` (not on the account), `400`
 *  (refused), `409` (basket changed or a request is still running). Nothing else reaches the page. */
export function describeReorderError(error: unknown): { title: string; message: string } {
  if (error instanceof ApiNotFoundError) {
    return {
      title: 'We couldn’t find that order.',
      message:
        'It may have been removed, or it isn’t on your account. Nothing was added to your basket.',
    };
  }
  if (
    error instanceof ApiValidationError &&
    reorderViolationCodes(error).includes('IdempotencyKeyRequired')
  ) {
    return {
      title: 'We couldn’t send that request.',
      message: 'Please reload the page and try again.',
    };
  }
  if (error instanceof ApiValidationError) {
    return {
      title: 'This order can’t be ordered again.',
      message: 'Nothing was added to your basket.',
    };
  }
  if (hasOrderingCode(error, 'RequestInProgress')) {
    return {
      title: 'We’re still adding your items.',
      message: 'Your first request is still being processed. Please wait a moment, then try again.',
    };
  }
  if (error instanceof ApiConflictError) {
    return {
      title: 'Your basket changed while we were adding items.',
      message: 'Please try again.',
    };
  }
  return { title: 'We couldn’t add these items.', message: 'Please try again in a moment.' };
}

function reorderViolationCodes(error: unknown): string[] {
  const response =
    error instanceof ApiConflictError || error instanceof ApiValidationError
      ? error.response
      : undefined;
  return response?.errors?.map((e) => e.errorCode) ?? [];
}

// -------------------------------------------------------------------------------------------
// HO-XCT-002 §11.7 — retention, erasure, backup and restore. The server's own message is preferred
// (HO-XCT-001 `OperationsMessages` is written for a person); these sentences are the fallback when
// it is empty, and `errorCode` itself is never shown (NFR-USA-4).
// -------------------------------------------------------------------------------------------

export const OPERATIONS_CODE_MESSAGES: Readonly<Record<string, string>> = {
  RecordIsRetained: "This record is kept for legal reasons and can't be deleted.",
  CustomerRecordMerged:
    'This record was merged into another customer. Erase the surviving record instead.',
  CustomerAccountNotFound: "We couldn't find that customer.",
  RetentionRunAlreadyInProgress: 'A retention run is already running. Try again when it finishes.',
  ReapplyListTooLarge: "That's more than 500 customers. Split the list.",
  InvalidRestoreTestTimes:
    'The times do not run in order. Check the failure, recovery and restore times.',
  RestoreTestChecksRequired: 'Add at least one check from the drill output.',
  RestoreTestAlreadyRecorded:
    'A restore test is already recorded for this date and backup set. Choose the test it replaces.',
  SupersededRestoreTestNotFound: "The test you chose to replace couldn't be found.",
  ActiveBranchRequired: 'Choose a branch first.',
  InvalidDateRange: 'Choose a start and end date, at most 93 days apart.',
};

/** Violation codes on a `400`/`409` body, in order. */
export function operationsViolationCodes(error: unknown): string[] {
  const response =
    error instanceof ApiValidationError || error instanceof ApiConflictError
      ? error.response
      : undefined;
  return response?.errors?.map((e) => e.errorCode) ?? [];
}

export function hasOperationsCode(error: unknown, code: string): boolean {
  return operationsViolationCodes(error).includes(code);
}

/** One display string for an operations action that failed. Never contains an error code or id. */
export function describeOperationsError(error: unknown): string {
  if (error instanceof OfflineError) return OFFLINE_WRITE_MESSAGE;
  if (error instanceof ApiForbiddenError) return describeForbidden(error);
  if (error instanceof ApiNotFoundError) return "We couldn't find that record.";
  if (error instanceof ApiValidationError || error instanceof ApiConflictError) {
    const errors = error.response?.errors ?? [];
    if (errors.length > 0) {
      return errors
        .map((e) => e.errorMessage || OPERATIONS_CODE_MESSAGES[e.errorCode] || GENERIC_ERROR_MESSAGE)
        .join(' ');
    }
  }
  return GENERIC_ERROR_MESSAGE;
}

// ---------------------------------------------------------------------------------------------
// HO-RPT-002 §11.7, NFR-USA-4 — Reporting. The server's own message is preferred whenever it sends
// one (HO-RPT-001 §10.4 writes them in plain language with the next step); the text below is the
// fallback when it does not. `errorCode` picks a fallback and drives behaviour — it is never
// rendered (HO-ACC-002 §11.14).
// ---------------------------------------------------------------------------------------------

export const REPORT_CODE_MESSAGES: Readonly<Record<string, string>> = {
  UnknownReport: "That report doesn't exist.",
  ReportRangeRequired: 'Choose a date range: both a start date and an end date.',
  ReportRangeInverted:
    'The end date is before the start date. Choose an end date on or after the start date.',
  ReportRangeTooLong: 'That range is too long for this report. Choose a shorter range.',
  InvalidReportParameter: 'One of the filters has a value that is not allowed. Choose a listed value.',
  UnknownReportParameter: 'One of the filters does not belong to this report. Reset the filters.',
  CrossBranchReportNotPermitted: 'You can run this for your own branch.',
  BranchNotAssigned: "You aren't assigned to that branch. Choose one of your branches.",
  ReportTooLargeForCsv: 'Too many rows for a CSV export. Narrow the date range or the filters.',
  ReportTooLargeForPdf: 'Too many rows for a PDF — export CSV instead.',
  ReportTimedOut: 'That took too long. Try a shorter range or a single branch.',
  ReportScheduleNotFound: "That schedule doesn't exist.",
  InvalidReportSchedule: 'Check the schedule and try again.',
  InvalidReportSchedulePeriod: 'That period does not suit this report. Choose one of the periods offered.',
  ReportRecipientRequired: 'Choose at least one recipient.',
  ReportRecipientLimitExceeded: 'A schedule can have at most 20 recipients.',
  ReportRecipientNotPermitted: "That person can't open this report, so they can't receive it.",
  ReportRecipientHasNoEmail: 'That person has no email address, so they cannot receive a report.',
  ReportRecipientNotAssignedToBranch: "That person isn't assigned to the schedule's branch.",
  ReportScheduleCancelled: 'This schedule was cancelled and cannot be changed. Create a new one.',
  ReportFormatNotSupported: 'A schedule can send a CSV or a PDF.',
  StaleVersion: 'Someone else changed this schedule. Reload it and try again.',
};

export interface ReportViolation {
  propertyName: string;
  errorCode: string;
  message: string;
}

/** Every violation of a `400`/`403`/`409`/`413`, as plain text, in order. */
export function reportViolations(error: unknown): ReportViolation[] {
  const response =
    error instanceof ApiValidationError || error instanceof ApiConflictError
      ? error.response
      : error instanceof ApiRateLimitedError
        ? error.response
        : undefined;
  const fromResponse = (response?.errors ?? []).map((violation) => ({
    propertyName: violation.propertyName ?? '',
    errorCode: violation.errorCode,
    message:
      violation.errorMessage || REPORT_CODE_MESSAGES[violation.errorCode] || GENERIC_ERROR_MESSAGE,
  }));
  if (fromResponse.length > 0) return fromResponse;
  if (error instanceof ApiForbiddenError) {
    return (error.body.errors ?? []).map((violation) => ({
      propertyName: '',
      errorCode: violation.errorCode,
      message:
        violation.errorCode === 'ActionNotPermitted'
          ? PERMISSION_DENIED_MESSAGE
          : violation.errorMessage ||
            REPORT_CODE_MESSAGES[violation.errorCode] ||
            PERMISSION_DENIED_MESSAGE,
    }));
  }
  return [];
}

export function hasReportCode(error: unknown, code: string): boolean {
  return reportViolations(error).some((violation) => violation.errorCode === code);
}

/** A `429` carries `Retry-After` (the per-account concurrency limit, backlog 42) — say when. */
/**
 * A `429` may carry `Retry-After`. The API does not expose that header cross-origin (RPT backlog 88),
 * so `client.ts` and the export helper fall back to 60; a value of 60 is therefore treated as an
 * estimate and worded as one, and every other value is "about" that long.
 */
function describeRateLimited(error: ApiRateLimitedError): string {
  const seconds = Math.max(1, Math.round(error.retryAfterSeconds));
  const lead = "You're running reports too quickly.";
  if (seconds === 60) return `${lead} Try again in a minute or so.`;
  if (seconds >= 120) return `${lead} Try again in about ${Math.ceil(seconds / 60)} minutes.`;
  return `${lead} Try again in about ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;
}

/** One sentence for a Reporting failure. A bare `5xx` (the access log failing closed)
 *  says that nothing was shown, because that is exactly what happened. */
export function describeReportError(error: unknown): string {
  if (error instanceof ApiRateLimitedError) return describeRateLimited(error);
  if (error instanceof ApiConflictError && reportViolations(error).length === 0) {
    return REPORT_CODE_MESSAGES.StaleVersion ?? GENERIC_ERROR_MESSAGE;
  }
  const violations = reportViolations(error);
  if (violations.length > 0) return violations.map((v) => v.message).join(' ');
  if (error instanceof ApiNotFoundError) return REPORT_CODE_MESSAGES.UnknownReport ?? GENERIC_ERROR_MESSAGE;
  if (error instanceof ApiError && error.status >= 500) {
    return "The report couldn't be opened just now, so nothing was shown. Please try again.";
  }
  return GENERIC_ERROR_MESSAGE;
}
