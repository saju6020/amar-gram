import { http, HttpResponse, type HttpHandler } from 'msw';
import { isGuid } from '@/lib/validation/guid';
import { accountsFixtureIds, getStaffRoleIdsForRequest } from '../areas/accounts';
import {
  MAX_NOTE_LENGTH,
  ScheduleViolation,
  type SubscriptionStatusName,
} from './schedule';
import {
  cancelOf,
  commerceClock,
  customerView,
  cycleViewOf,
  cyclesOf,
  db,
  findSubscription,
  getMaxExportRows,
  isPurchasable,
  reinstateOf,
  staffDetailOf,
  staffRowOf,
  subscriptionViewOf,
  unpaidItems,
  type DbSubscription,
} from './store';

/**
 * `mocks/handlers/subscriptions/staff.ts` — HO-P6 S2 (§11.3.7). The staff endpoints T1, T2, T4, T5, T6, T7 and T8 of
 * `StaffSubscriptionsController` (`src/Api/AmarGram.Api/Controllers/StaffSubscriptionsController.cs`), over the S0 store and
 * its port of `SubscriptionSchedule.cs`. T3 (due tomorrow) and T9 (the customer summary) belong to slice S3
 * (`touchpoints.ts`), so `GET …/due-tomorrow` is left to that handler (see `idParam`).
 *
 * Every refusal cites the server line it mirrors. Role checks use the three arrays of
 * `Shared/Common/Constants/ActionRoles.Subscriptions.cs:12-14`; a request with no modelled staff session passes, like the
 * other mocks, and `setMockSubscriptionRoles` is the test seam for a role the session cookie cannot give.
 */

const API = '*/api/staff/subscriptions';

/** `ActionRoles.Subscriptions.cs:12-14`, ADR-248. Kept apart from `lib/api/staff-subscriptions.ts`; a test pins them equal. */
export const MOCK_VIEW_ROLES: readonly string[] = ['Reception', 'Inventory', 'ShopManager', 'Accountant', 'Administrator'];
export const MOCK_MANAGE_ROLES: readonly string[] = ['ShopManager', 'Administrator'];
export const MOCK_EXPORT_ROLES: readonly string[] = ['ShopManager', 'Accountant', 'Administrator'];

let roleOverride: string[] | null = null;

/** Test seam: answer as these roles regardless of the session cookie. `null` clears it. */
export function setMockSubscriptionRoles(roles: string[] | null): void {
  roleOverride = roles;
}

/** The server's `403` from `[RequireAction]` (StaffSubscriptionsController.cs:26, 42, 62, 79, 92, 104, 118). */
function lacksRole(request: Request, allowed: readonly string[]): boolean {
  const roles = roleOverride ?? getStaffRoleIdsForRequest(request);
  return roles !== null && !roles.some((role) => allowed.includes(role));
}

const forbidden = () =>
  HttpResponse.json(
    { errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'Not permitted.' }] },
    { status: 403 },
  );
const notFound = () => new HttpResponse(null, { status: 404 });

/** A returned violation: the usual `ValidationResponse` (SubscriptionHandlerSupport.cs:18-32). */
function violation(propertyName: string, errorCode: string, errorMessage: string, status = 400) {
  return HttpResponse.json(
    { errors: [{ propertyName, errorCode, errorMessage, resourceName: 'Subscription' }], isValid: false },
    { status },
  );
}

/** The controller's plain `{ error }` 400 (StaffSubscriptionsController.cs:143-145). */
const plainError = (error: string) => HttpResponse.json({ error }, { status: 400 });

/** What ASP.NET's `[ApiController]` answers when a query or body value cannot bind (an object-shaped `errors`). */
function bindingError(field: string) {
  return HttpResponse.json(
    {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { [field]: [`The value provided for ${field} is not valid.`] },
    },
    { status: 400 },
  );
}

/** `EnumerationParsing.TryParse`: blank is no filter; a display name matches case-insensitively (EnumerationParsing.cs:20-30). */
function parseEnum<T extends string>(value: string | null, all: readonly T[]): { ok: true; value: T | null } | { ok: false } {
  if (value === null || value.trim() === '') return { ok: true, value: null };
  const found = all.find((name) => name.toLowerCase() === value.toLowerCase());
  return found ? { ok: true, value: found } : { ok: false };
}

const STATUSES: readonly SubscriptionStatusName[] = ['Active', 'Paused', 'Suspended', 'Cancelled'];
const STATUS_ORDER: Record<SubscriptionStatusName, number> = { Active: 1, Paused: 2, Suspended: 3, Cancelled: 4 };
const REASONS = ['UnpaidCycles', 'ProductUnavailable'] as const;
const METHODS = ['CashOnDelivery', 'BankTransfer', 'PayAtPickup'] as const;

interface Filters {
  status: SubscriptionStatusName | null;
  suspensionReason: (typeof REASONS)[number] | null;
  paymentMethod: (typeof METHODS)[number] | null;
  text: string;
  sort: string;
}

/** `TryFilters` (StaffSubscriptionsController.cs:136-147): status, then reason, then method; the first bad one is a `{ error }` 400. */
function readFilters(url: URL): Filters | Response {
  const status = parseEnum(url.searchParams.get('status'), STATUSES);
  if (!status.ok) return plainError('status is not a subscription status.'); // :143
  const reason = parseEnum(url.searchParams.get('suspensionReason'), REASONS);
  if (!reason.ok) return plainError('suspensionReason is not a suspension reason.'); // :144
  const method = parseEnum(url.searchParams.get('paymentMethod'), METHODS);
  if (!method.ok) return plainError('paymentMethod is not a payment method.'); // :145
  return {
    status: status.value,
    suspensionReason: reason.value,
    paymentMethod: method.value,
    text: (url.searchParams.get('q') ?? '').trim().toLowerCase(),
    sort: (url.searchParams.get('sort') ?? 'nextDeliveryOn').toLowerCase(),
  };
}

/** `StaffSubscriptionRows.Filter` (SubscriptionStaffQueryHandlers.cs:17-34): product name (as subscribed), customer name or mobile. */
function filtered(f: Filters): DbSubscription[] {
  return db.subscriptions.filter((s) => {
    if (f.status && s.status !== f.status) return false;
    if (f.suspensionReason && s.suspensionReason !== f.suspensionReason) return false;
    if (f.paymentMethod && s.terms.paymentMethod !== f.paymentMethod) return false;
    if (f.text === '') return true;
    const customer = customerView(s.customerId);
    return (
      s.productName.toLowerCase().includes(f.text) ||
      customer.name.toLowerCase().includes(f.text) ||
      (customer.mobile ?? '').toLowerCase().includes(f.text)
    );
  });
}

const byId = (a: DbSubscription, b: DbSubscription) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const nullsLast = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

/** `StaffSubscriptionRows.Sorted` (:37-43); an unknown `sort` is the default, never a 400. Postgres puts NULLs last ascending and first descending. */
function sorted(rows: DbSubscription[], sort: string): DbSubscription[] {
  const copy = [...rows];
  switch (sort) {
    case '-nextdeliveryon':
      return copy.sort((a, b) => -nullsLast(a.nextDeliveryOn, b.nextDeliveryOn) || byId(a, b));
    case 'status':
      return copy.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || nullsLast(a.nextDeliveryOn, b.nextDeliveryOn) || byId(a, b));
    case 'product':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName) || byId(a, b));
    default:
      return copy.sort((a, b) => nullsLast(a.nextDeliveryOn, b.nextDeliveryOn) || byId(a, b));
  }
}

/**
 * `PagingHelper.ApplyPaging` (PagingHelper.cs:31-47) then `SubscriptionPaging.Of` (SubscriptionCustomerQueryHandlers.cs:15): a page number above
 * 1,000,000 or a page size of 0 or less is a 400; a larger page size is clamped to 100; the default is 20.
 */
function readPaging(url: URL): { pageNumber: number; pageSize: number } | Response {
  const rawNumber = url.searchParams.get('pageNumber');
  const rawSize = url.searchParams.get('pageSize');
  if (rawNumber !== null && rawNumber !== '' && !/^-?\d+$/.test(rawNumber)) return bindingError('pageNumber');
  if (rawSize !== null && rawSize !== '' && !/^-?\d+$/.test(rawSize)) return bindingError('pageSize');
  const number = rawNumber ? Number(rawNumber) : null;
  const size = rawSize ? Number(rawSize) : null;
  if (number !== null && number > 1_000_000) return violation('pageNumber', 'InvalidPageNumber', 'pageNumber must not exceed 1000000.'); // :33-34
  let pageSize = 20;
  if (size !== null) {
    if (size <= 0) return violation('pageSize', 'InvalidPageSize', 'pageSize must be greater than zero.'); // :38-41
    pageSize = Math.min(size, 100);
  }
  return { pageNumber: number !== null && number > 0 ? number : 1, pageSize };
}

function pagedOf<T>(all: T[], pageNumber: number, pageSize: number) {
  const start = (pageNumber - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), pageNumber, pageSize, totalCount: all.length };
}

/** `InventoryCsv.Cell` (Shared/Common/Helpers/InventoryCsv.cs:28-49): every cell quoted, the CSV-injection guard on text. */
function csvCell(value: string | number | null): string {
  if (value === null) return '""';
  const text = String(value);
  const guarded = typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'SubscriptionId', 'Customer', 'Mobile', 'Product', 'Variant', 'Quantity', 'IntervalWeeks', 'Status',
  'SuspensionReason', 'NextDeliveryOn', 'PaymentMethod', 'UnpaidStreak',
] as const; // StaffSubscriptionsController.cs:72

/**
 * The `{id:guid}` route segment. A segment that is not a GUID never matches the real route, so it is a 404; `due-tomorrow` is a
 * sibling static route that slice S3's handler answers, so it is handed on (`undefined` makes MSW try the next handler).
 */
function idParam(raw: string | readonly string[] | undefined): string | null | undefined {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (id === 'due-tomorrow') return undefined;
  return id && isGuid(id) ? id : null;
}

/** Reads a JSON body; an unreadable one binds as an empty request. */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A `ScheduleViolation` thrown by the store, as the handler's `FromRule` returns it (SubscriptionHandlerSupport.cs:18-32). */
function fromRule(error: unknown) {
  if (error instanceof ScheduleViolation) return violation(error.propertyName, error.code, error.message);
  throw error;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const staffSubscriptionsHandlers: HttpHandler[] = [
  // T1 -- list (StaffSubscriptionsController.cs:25-38)
  http.get(API, ({ request }) => {
    if (lacksRole(request, MOCK_VIEW_ROLES)) return forbidden();
    const url = new URL(request.url);
    const filters = readFilters(url);
    if (filters instanceof Response) return filters;
    const paging = readPaging(url);
    if (paging instanceof Response) return paging;
    const clock = commerceClock();
    const rows = sorted(filtered(filters), filters.sort).map((s) => staffRowOf(s, clock));
    return HttpResponse.json(pagedOf(rows, paging.pageNumber, paging.pageSize));
  }),

  // T2 -- unpaid worklist (:40-49); Suspended first, then by streak
  http.get(`${API}/unpaid`, ({ request }) => {
    if (lacksRole(request, MOCK_VIEW_ROLES)) return forbidden();
    const paging = readPaging(new URL(request.url));
    if (paging instanceof Response) return paging;
    return HttpResponse.json(pagedOf(unpaidItems(), paging.pageNumber, paging.pageSize));
  }),

  // T4 -- CSV export (:60-76): T1's filters, no paging, 413 above the cap
  http.get(`${API}/export.csv`, ({ request }) => {
    if (lacksRole(request, MOCK_EXPORT_ROLES)) return forbidden();
    const filters = readFilters(new URL(request.url));
    if (filters instanceof Response) return filters;
    const clock = commerceClock();
    const rows = sorted(filtered(filters), filters.sort).map((s) => staffRowOf(s, clock));
    if (rows.length > getMaxExportRows()) return HttpResponse.json({ error: 'Too many rows to export. Narrow the filters.' }, { status: 413 }); // :69
    const lines = [CSV_HEADERS.map(csvCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id, r.customer.name, r.customer.mobile, r.product.productName, r.product.variantLabel, r.quantity, r.intervalWeeks,
          r.status, r.suspensionReason, r.nextDeliveryOn, r.paymentMethod, r.unpaidStreak,
        ].map(csvCell).join(','),
      );
    }
    return new HttpResponse(`${lines.join('\r\n')}\r\n`, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="subscriptions.csv"' },
    });
  }),

  // T5 -- detail (:78-89); another id, or one that is not a GUID, is the same 404 with no body (:84)
  http.get(`${API}/:id`, ({ request, params }) => {
    const id = idParam(params.id);
    if (id === undefined) return undefined;
    if (lacksRole(request, MOCK_VIEW_ROLES)) return forbidden();
    const s = id ? findSubscription(id) : undefined;
    return s ? HttpResponse.json(staffDetailOf(s)) : notFound();
  }),

  // T6 -- cycles, newest first (:91-100)
  http.get(`${API}/:id/cycles`, ({ request, params }) => {
    const id = idParam(params.id);
    if (lacksRole(request, MOCK_VIEW_ROLES)) return forbidden();
    const paging = readPaging(new URL(request.url));
    if (paging instanceof Response) return paging;
    const s = id ? findSubscription(id) : undefined;
    if (!s) return notFound(); // :99
    return HttpResponse.json(pagedOf(cyclesOf(s.id).map(cycleViewOf), paging.pageNumber, paging.pageSize));
  }),

  // T7 -- reinstate (:102-114); the validator runs before the handler (SubscriptionCommandValidators.cs:99-106)
  http.post(`${API}/:id/reinstate`, async ({ request, params }) => {
    const id = idParam(params.id);
    if (lacksRole(request, MOCK_MANAGE_ROLES)) return forbidden();
    const body = await readBody(request);
    const firstDeliveryOn = body.firstDeliveryOn;
    if (firstDeliveryOn !== undefined && firstDeliveryOn !== null && (typeof firstDeliveryOn !== 'string' || !DATE_ONLY.test(firstDeliveryOn))) {
      return bindingError('firstDeliveryOn');
    }
    const reason = typeof body.reason === 'string' ? body.reason : '';
    if (reason.trim() === '') return violation('Reason', 'ReinstatementReasonRequired', 'Give a reason for restarting this subscription.'); // validators :104
    if (reason.length > MAX_NOTE_LENGTH) {
      return violation('Reason', 'MaximumLengthValidator', `The length of 'Reason' must be ${MAX_NOTE_LENGTH} characters or fewer. You entered ${reason.length} characters.`);
    }
    const s = id ? findSubscription(id) : undefined;
    if (!s) return notFound(); // SubscriptionWorkerCommandHandlers.cs:157
    if (s.status === 'Suspended' && !isPurchasable(s.skuId)) {
      // :160-165 (SubscriptionMessages.SkuNotSubscribableInactive)
      return violation('SubscriptionId', 'SkuNotSubscribable', 'This product is not available to subscribe to right now.');
    }
    try {
      reinstateOf(s, accountsFixtureIds.adminStaffId, reason, typeof firstDeliveryOn === 'string' ? firstDeliveryOn : null, commerceClock());
    } catch (error) {
      return fromRule(error); // SubscriptionCannotBeReinstated, ReinstatementReasonRequired, InvalidFirstDeliveryDate (SubscriptionAggregate.cs:256-277)
    }
    return HttpResponse.json(subscriptionViewOf(s)); // the plain view, not the staff detail (:130-134)
  }),

  // T8 -- staff cancel (:116-128); the reason is always StaffCancelled and the note is required (validators :58-71)
  http.post(`${API}/:id/cancel`, async ({ request, params }) => {
    const id = idParam(params.id);
    if (lacksRole(request, MOCK_MANAGE_ROLES)) return forbidden();
    const body = await readBody(request);
    const note = typeof body.note === 'string' ? body.note : '';
    if (note.length > MAX_NOTE_LENGTH) {
      return violation('Note', 'MaximumLengthValidator', `The length of 'Note' must be ${MAX_NOTE_LENGTH} characters or fewer. You entered ${note.length} characters.`);
    }
    if (note.trim() === '') return violation('Note', 'CancellationReasonRequired', 'Give a reason for cancelling this subscription.'); // :69-70
    const s = id ? findSubscription(id) : undefined;
    if (!s) return notFound(); // SubscriptionCustomerCommandHandlers.cs:211
    try {
      cancelOf(s, accountsFixtureIds.adminStaffId, 'StaffCancelled', note, commerceClock());
    } catch (error) {
      return fromRule(error); // InvalidSubscriptionTransition for a cancelled one (SubscriptionSchedule.cs)
    }
    return HttpResponse.json(subscriptionViewOf(s));
  }),
];
