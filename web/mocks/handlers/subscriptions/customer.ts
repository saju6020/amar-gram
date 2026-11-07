import { http, HttpResponse, type HttpHandler } from 'msw';
import { accountsFixtureIds } from '../areas/accounts';
import { computeQuote } from '../ordering/quote';
import { skuInfo } from '../ordering/store';
import { hasCustomerSession, unauthorised } from '../ordering/fixtures';
import { findSku } from '../shop/store';
import {
  ALLOWED_INTERVAL_WEEKS,
  MAX_LIVE_SUBSCRIPTIONS_PER_CUSTOMER,
  MAX_NOTE_LENGTH,
  MAX_QUANTITY,
  ScheduleViolation,
  createTerms,
  termsEqual,
  type FulfilmentName,
  type PaymentMethodName,
  type ScheduleTerms,
} from './schedule';
import {
  cancelOf,
  changeResultOf,
  changeTermsOf,
  commerceClock,
  countLive,
  customerDetailOf,
  cyclesOf,
  cycleViewOf,
  db,
  findLiveFor,
  findOwnSubscription,
  isLive,
  isPurchasable,
  isSubscribableSku,
  optionsOf,
  pauseOf,
  resumeOf,
  skipDeliveryOf,
  startSubscription,
  subscriptionViewOf,
  withdrawPendingOf,
  type DbSubscription,
} from './store';

/**
 * `mocks/handlers/subscriptions/customer.ts` — HO-P6 S1 (§11.2.10, ADR-FE-185, ADR-FE-193). The customer
 * endpoints C1 to C12 of `CustomerSubscriptionsController` (`src/Api/AmarGram.Api/Controllers/`) over the S0
 * store. The order of the checks is the server's: the controller's enumeration parse (the `{ error }` 400),
 * then the command validator (every rule at once, the usual `ValidationResponse`), then the handler (owner,
 * version, catalogue, limits, terms, servability, schedule). Someone else's subscription is the same bodiless
 * 404 as a missing one (ADR-248). Each refusal below cites the server line it mirrors.
 *
 * The signed-in customer is the one the accounts mock signs in (the `pc_session` cookie), as the ordering mock does.
 */

const API = '*/api/customers/me/subscriptions';
const CUSTOMER_ID = accountsFixtureIds.customerId;

// ---- response helpers -------------------------------------------------------------------------------------

interface Problem {
  propertyName: string;
  errorCode: string;
  errorMessage: string;
}

/** The usual `ValidationResponse` body (SubscriptionHandlerSupport.cs:18-24 and FluentValidation). */
function validationBody(problems: Problem[]) {
  return { errors: problems.map((p) => ({ ...p, resourceName: 'Subscription' })), isValid: false };
}
const refuse = (problems: Problem[], status = 400) =>
  HttpResponse.json(validationBody(problems), { status });
const refuseOne = (propertyName: string, errorCode: string, errorMessage: string, status = 400) =>
  refuse([{ propertyName, errorCode, errorMessage }], status);

/** The controller's plain `{ error }` 400 (CustomerSubscriptionsController.cs:56, 141-142, 180, 186). */
const plainError = (error: string) => HttpResponse.json({ error }, { status: 400 });

/** ASP.NET's model-binding 400 (a malformed body or query value): a `ProblemDetails`, not a `ValidationResponse`. */
const bindingError = (field: string) =>
  HttpResponse.json(
    {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { [field]: ['The value is not valid.'] },
    },
    { status: 400 },
  );

const notFound = () => new HttpResponse(null, { status: 404 });

function violationResponse(error: ScheduleViolation) {
  // SubscriptionHttp.Failure (SubscriptionHttp.cs:34-40): not-found codes 404, StaleVersion 409, everything else 400.
  if (error.code === 'SubscriptionNotFound' || error.code === 'ProductNotFound') return notFound();
  if (error.code === 'StaleVersion') return refuseOne(error.propertyName, error.code, error.message, 409);
  return refuseOne(error.propertyName, error.code, error.message);
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** `EnumerationParsing.TryParse` (EnumerationParsing.cs:20-30): case-insensitive on the name; blank is "null", which the controller refuses. */
function parseName<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  if (typeof raw !== 'string') return null;
  return allowed.find((a) => a.toLowerCase() === raw.trim().toLowerCase()) ?? null;
}

const FULFILMENTS = ['Delivery', 'Pickup'] as const;
const PAYMENTS = ['CashOnDelivery', 'BankTransfer', 'PayAtPickup'] as const;
const CUSTOMER_REASONS = [
  'NoLongerNeeded',
  'TooMuchStock',
  'TastesDidNotSuit',
  'TooExpensive',
  'SwitchingProduct',
  'Other',
] as const;
const ALL_REASONS = [...CUSTOMER_REASONS, 'StaffCancelled', 'CustomerMerged', 'AccountDeleted'] as const;

type Fulfilment = (typeof FULFILMENTS)[number];

/** CustomerSubscriptionsController.TryFulfilmentAndPayment, :173-191. */
function parseFulfilmentAndPayment(body: Record<string, unknown>):
  | { ok: true; fulfilment: Fulfilment; payment: PaymentMethodName }
  | { ok: false; response: Response } {
  const fulfilment = parseName(body.fulfilment, FULFILMENTS);
  if (!fulfilment) return { ok: false, response: plainError('fulfilment must be Delivery or Pickup.') };
  const payment = parseName(body.paymentMethod, PAYMENTS);
  if (!payment) {
    return {
      ok: false,
      response: plainError('paymentMethod must be CashOnDelivery, BankTransfer or PayAtPickup.'),
    };
  }
  return { ok: true, fulfilment, payment };
}

const optionalGuid = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' && value !== EMPTY_GUID ? value : null;

// ---- paging (PagingHelper.cs:31-47, SubscriptionCustomerQueryHandlers.cs:14-16) ---------------------------------

const MAX_PAGE_NUMBER = 1_000_000;

function readPaging(url: URL): { ok: true; pageNumber: number; pageSize: number } | { ok: false; response: Response } {
  const rawNumber = url.searchParams.get('pageNumber');
  const rawSize = url.searchParams.get('pageSize');
  if ((rawNumber !== null && !/^-?\d+$/.test(rawNumber)) || (rawSize !== null && !/^-?\d+$/.test(rawSize))) {
    return { ok: false, response: bindingError(rawNumber !== null && !/^-?\d+$/.test(rawNumber) ? 'pageNumber' : 'pageSize') };
  }
  const number = rawNumber === null ? null : Number(rawNumber);
  const size = rawSize === null ? null : Number(rawSize);
  if (number !== null && number > MAX_PAGE_NUMBER) {
    return {
      ok: false,
      response: refuseOne('pageNumber', 'InvalidPageNumber', `pageNumber must not exceed ${MAX_PAGE_NUMBER}.`),
    };
  }
  if (size !== null && size <= 0) {
    return {
      ok: false,
      response: refuseOne('pageSize', 'InvalidPageSize', 'pageSize must be greater than zero.'),
    };
  }
  // PagingHelper clamps to 100; SubscriptionPaging.Of defaults an unset size to 20 and a page below 1 to 1.
  return {
    ok: true,
    pageNumber: Math.max(number ?? 1, 1),
    pageSize: Math.min(size ?? 20, 100),
  };
}

function pagedResult<T>(all: T[], pageNumber: number, pageSize: number) {
  const start = (pageNumber - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), pageNumber, pageSize, totalCount: all.length };
}

// ---- servability: Orders' own decision, asked of the ordering mock's pricing ---------------------------------

interface BookAddress {
  id: string;
  district: string;
  postalCode: string | null;
}

/** The customer's address book (Accounts), read through its endpoint like the ordering mock does. */
async function addressBook(request: Request): Promise<BookAddress[]> {
  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/customers/me/addresses`, { credentials: 'include' });
    if (!response.ok) return [];
    const body = (await response.json()) as { addresses: BookAddress[] };
    return body.addresses;
  } catch {
    return [];
  }
}

const toOrderMethod = (method: PaymentMethodName): string =>
  method === 'PayAtPickup' ? 'PayOnCollection' : method;

/**
 * `SubscriptionCheckout.QuoteAsync` over Orders' pricing (SubscriptionHandlerSupport.cs:54-63). The quote is the
 * ordering mock's `computeQuote` for one line at the SKU's price; the subscriber discount is not applied to it, so
 * a cash-on-delivery value that sits between the discounted and the undiscounted total is refused here and
 * accepted by the server (a narrow band, noted in the slice report).
 */
async function quoteTerms(
  request: Request,
  skuId: string,
  quantity: number,
  fulfilment: FulfilmentName,
  addressId: string | null,
  branchId: string | null,
  payment: PaymentMethodName,
) {
  const info = skuInfo(skuId);
  const book = fulfilment === 'Delivery' ? await addressBook(request) : [];
  const found = addressId ? book.find((a) => a.id === addressId) : undefined;
  return computeQuote(
    [{ lineId: 'subscription', skuId, quantity, priceWhenAddedCents: info?.priceCents ?? 0 }],
    {
      fulfilment,
      address: fulfilment === 'Delivery' ? (found ? { district: found.district, postalCode: found.postalCode } : null) : undefined,
      pickupBranchId: branchId ?? undefined,
      paymentMethod: toOrderMethod(payment),
      customerHasOrders: true,
    },
  );
}

/** SubscriptionHandlerSupport.cs:66-70, the blocking codes that make terms unservable, in the server's order. */
const TERMS_BLOCKING_CODES = [
  'DeliveryAddressNotFound',
  'AddressOutsideServedZones',
  'ServiceLevelUnavailable',
  'PickupBranchUnavailable',
  'DeliveryTaxNotConfigured',
  'PaymentMethodUnavailable',
] as const;

interface PaymentOptionWire {
  method: string;
  available: boolean;
  message: string | null;
  unavailableReason: string | null;
}

/** `SubscriptionCheckout.TermsRefusal`, SubscriptionHandlerSupport.cs:73-92 (texts from OrderMessages.cs:41, 46, 47). */
function termsRefusal(
  quote: ReturnType<typeof computeQuote>,
  payment: PaymentMethodName,
): { property: string; code: string; message: string } | null {
  const code = TERMS_BLOCKING_CODES.find((c) => quote.blocking.includes(c));
  if (!code) return null;
  if (code === 'PaymentMethodUnavailable') {
    const options = (quote.wire.paymentOptions ?? []) as PaymentOptionWire[];
    const option = options.find((o) => o.method === toOrderMethod(payment));
    return {
      property: 'PaymentMethod',
      code,
      message: option?.message ?? 'That payment method is not available for this order.',
    };
  }
  switch (code) {
    case 'DeliveryAddressNotFound':
      return { property: 'DeliveryAddressId', code, message: 'Choose a delivery address from your address book.' };
    case 'AddressOutsideServedZones':
      return {
        property: 'DeliveryAddressId',
        code,
        message: 'We do not deliver to this address yet. You can collect your order from one of our branches instead.',
      };
    case 'PickupBranchUnavailable':
      return { property: 'PickupBranchId', code, message: 'That branch is not available for collection.' };
    case 'DeliveryTaxNotConfigured':
      return {
        property: 'Fulfilment',
        code,
        message: 'Delivery is temporarily unavailable. Please choose collection from a branch, or try again later.',
      };
    default:
      return { property: 'Fulfilment', code, message: 'That delivery option is not available for this address.' };
  }
}

// ---- validators (SubscriptionCommandValidators.cs) ------------------------------------------------------------

const intFrom = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

/** `FulfilmentIdsAgree`, SubscriptionCommandValidators.cs:13-14. */
const fulfilmentIdsAgree = (fulfilment: Fulfilment, addressId: string | null, branchId: string | null) =>
  fulfilment === 'Delivery' ? addressId !== null && branchId === null : branchId !== null && addressId === null;

const FULFILMENT_RULE: Problem = {
  propertyName: 'Fulfilment',
  errorCode: 'PredicateValidator',
  errorMessage: 'A delivery needs an address and a collection needs a branch, not both.',
};

/** SubscriptionCommandValidators.cs:23-26 (create) and :36-39 (change terms): ranges and the fulfilment/ids rule. */
function termsShapeProblems(
  quantity: number | null,
  interval: number | null,
  fulfilment: Fulfilment,
  addressId: string | null,
  branchId: string | null,
): Problem[] {
  const problems: Problem[] = [];
  if (quantity === null || quantity < 1 || quantity > MAX_QUANTITY) {
    problems.push({
      propertyName: 'Quantity',
      errorCode: 'InclusiveBetweenValidator',
      errorMessage: `'Quantity' must be between 1 and ${MAX_QUANTITY}. You entered ${quantity ?? 0}.`,
    });
  }
  if (interval === null || !ALLOWED_INTERVAL_WEEKS.includes(interval)) {
    problems.push({
      propertyName: 'IntervalWeeks',
      errorCode: 'PredicateValidator',
      errorMessage: 'is not an allowed interval.',
    });
  }
  if (!fulfilmentIdsAgree(fulfilment, addressId, branchId)) problems.push(FULFILMENT_RULE);
  return problems;
}

function termsFrom(body: Record<string, unknown>, fulfilment: Fulfilment, payment: PaymentMethodName): {
  quantity: number | null;
  interval: number | null;
  addressId: string | null;
  branchId: string | null;
  terms: () => ScheduleTerms;
} {
  const quantity = intFrom(body.quantity);
  const interval = intFrom(body.intervalWeeks);
  const addressId = optionalGuid(body.deliveryAddressId);
  const branchId = optionalGuid(body.pickupBranchId);
  return {
    quantity,
    interval,
    addressId,
    branchId,
    // SubscriptionTerms.Create: the same refusals in the same order (SubscriptionTerms.cs, ported as `createTerms`).
    terms: () =>
      createTerms({
        quantity: quantity ?? 0,
        intervalWeeks: interval ?? 0,
        fulfilment,
        deliveryAddressId: addressId,
        pickupBranchId: branchId,
        paymentMethod: payment,
      }),
  };
}

// ---- the handlers -----------------------------------------------------------------------------------------------

type Run = (sub: DbSubscription) => ReturnType<typeof changeResultOf> | Response;

/** `SubscriptionChangeFlow.RunAsync` (SubscriptionCustomerCommandHandlers.cs:244-255): own subscription, else 404; a violation is a 400. */
function ownedChange(id: string, request: Request, run: Run): Response {
  if (!hasCustomerSession(request)) return unauthorised();
  if (!GUID.test(id)) return notFound();
  const sub = findOwnSubscription(CUSTOMER_ID, id);
  if (!sub) return notFound();
  try {
    const result = run(sub);
    return result instanceof Response ? result : HttpResponse.json(result);
  } catch (error) {
    if (error instanceof ScheduleViolation) return violationResponse(error);
    throw error;
  }
}

export const customerSubscriptionsHandlers: HttpHandler[] = [
  // C1: GET options?skuId= (CustomerSubscriptionsController.cs:28-35). 404 for an unknown SKU.
  http.get(`${API}/options`, ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const skuId = new URL(request.url).searchParams.get('skuId');
    if (skuId !== null && !GUID.test(skuId)) return bindingError('skuId');
    const options = skuId ? optionsOf(CUSTOMER_ID, skuId) : null;
    return options ? HttpResponse.json(options) : notFound();
  }),

  // C2: GET payment-methods (CustomerSubscriptionsController.cs:37-48; SubscriptionCustomerQueryHandlers.cs:108-145).
  http.get(`${API}/payment-methods`, async ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const params = new URL(request.url).searchParams;
    const skuId = params.get('skuId');
    const rawQuantity = params.get('quantity');
    if ((skuId !== null && !GUID.test(skuId)) || (rawQuantity !== null && !/^-?\d+$/.test(rawQuantity))) {
      return bindingError(skuId !== null && !GUID.test(skuId) ? 'skuId' : 'quantity');
    }
    if (!skuId || !findSku(skuId)) return notFound(); // :114
    const addressId = optionalGuid(params.get('deliveryAddressId'));
    const branchId = optionalGuid(params.get('pickupBranchId'));
    const delivery = addressId !== null;
    if (!delivery && branchId === null) return HttpResponse.json([]); // :117
    const allowed: PaymentMethodName[] = delivery ? ['CashOnDelivery', 'BankTransfer'] : ['BankTransfer', 'PayAtPickup'];
    // :126 Math.Clamp(quantity, 1, MaxQuantity)
    const quantity = Math.min(Math.max(rawQuantity === null ? 1 : Number(rawQuantity), 1), MAX_QUANTITY);
    const quote = await quoteTerms(request, skuId, quantity, delivery ? 'Delivery' : 'Pickup', addressId, delivery ? null : branchId, allowed[0]!);
    const options = (quote.wire.paymentOptions ?? []) as PaymentOptionWire[];
    return HttpResponse.json(
      allowed.map((method) => {
        const option = options.find((o) => o.method === toOrderMethod(method));
        return {
          method,
          isAvailable: option?.available ?? false,
          unavailableReason: option && !option.available ? (option.message ?? option.unavailableReason) : null,
        };
      }),
    );
  }),

  // C3: GET ?status=&pageNumber=&pageSize= (CustomerSubscriptionsController.cs:50-63).
  http.get(API, ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const lower = status?.toLowerCase() ?? '';
    if (status && !['live', 'cancelled', 'all'].includes(lower)) {
      return plainError('status must be live or cancelled.'); // :56
    }
    const paging = readPaging(url);
    if (!paging.ok) return paging.response;
    const mine = db.subscriptions.filter((s) => s.customerId === CUSTOMER_ID);
    const rows = lower === 'live' ? mine.filter(isLive) : lower === 'cancelled' ? mine.filter((s) => !isLive(s)) : mine;
    // SubscriptionCustomerQueryHandlers.cs:30: not cancelled first, nextDeliveryOn (nulls last), newest start, id.
    const ordered = [...rows].sort(
      (a, b) =>
        Number(!isLive(a)) - Number(!isLive(b)) ||
        Number(a.nextDeliveryOn === null) - Number(b.nextDeliveryOn === null) ||
        (a.nextDeliveryOn ?? '').localeCompare(b.nextDeliveryOn ?? '') ||
        b.startedOn.localeCompare(a.startedOn) ||
        a.id.localeCompare(b.id),
    );
    const clock = commerceClock();
    const page = pagedResult(ordered, paging.pageNumber, paging.pageSize);
    return HttpResponse.json({ ...page, items: page.items.map((s) => subscriptionViewOf(s, clock)) });
  }),

  // C4: GET {id} (CustomerSubscriptionsController.cs:65-74). One flat object with `cycles`.
  http.get(`${API}/:id`, ({ request, params }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const id = String(params.id);
    const sub = GUID.test(id) ? findOwnSubscription(CUSTOMER_ID, id) : undefined;
    return sub ? HttpResponse.json(customerDetailOf(sub)) : notFound();
  }),

  // C5: GET {id}/cycles (CustomerSubscriptionsController.cs:76-86).
  http.get(`${API}/:id/cycles`, ({ request, params }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const id = String(params.id);
    const url = new URL(request.url);
    const paging = readPaging(url);
    if (!paging.ok) return paging.response;
    const sub = GUID.test(id) ? findOwnSubscription(CUSTOMER_ID, id) : undefined;
    if (!sub) return notFound();
    const page = pagedResult(cyclesOf(sub.id), paging.pageNumber, paging.pageSize);
    return HttpResponse.json({ ...page, items: page.items.map(cycleViewOf) });
  }),

  // C6: POST (CustomerSubscriptionsController.cs:88-107) -> 201 with the view.
  http.post(API, async ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const body = await readBody(request);
    if (!body) return bindingError('request');
    const parsed = parseFulfilmentAndPayment(body); // :92
    if (!parsed.ok) return parsed.response;

    const skuId = typeof body.skuId === 'string' ? body.skuId : '';
    if (skuId !== '' && !GUID.test(skuId)) return bindingError('skuId');
    const { quantity, interval, addressId, branchId, terms } = termsFrom(body, parsed.fulfilment, parsed.payment);
    const firstDeliveryOn = body.firstDeliveryOn;
    if (firstDeliveryOn != null && (typeof firstDeliveryOn !== 'string' || !DATE_ONLY.test(firstDeliveryOn))) {
      return bindingError('firstDeliveryOn');
    }

    // The validator (SubscriptionCommandValidators.cs:21-26): SkuId, Quantity, IntervalWeeks, Fulfilment, all at once.
    const problems = termsShapeProblems(quantity, interval, parsed.fulfilment, addressId, branchId);
    if (skuId === '' || skuId === EMPTY_GUID) {
      problems.unshift({ propertyName: 'SkuId', errorCode: 'NotEmptyValidator', errorMessage: "'Sku Id' must not be empty." });
    }
    if (problems.length > 0) return refuse(problems);

    // The handler (SubscriptionCustomerCommandHandlers.cs:33-83).
    if (!findSku(skuId)) return notFound(); // :39-40 ProductNotFound -> 404
    if (!isPurchasable(skuId)) {
      return refuseOne('SkuId', 'SkuNotSubscribable', 'This product is not available to subscribe to right now.'); // :42
    }
    if (!isSubscribableSku(skuId)) {
      return refuseOne('SkuId', 'SkuNotSubscribable', 'This product is not offered as a subscription.'); // :43
    }
    if (findLiveFor(CUSTOMER_ID, skuId)) {
      return refuseOne(
        'SkuId',
        'SubscriptionAlreadyExists',
        'You already have a subscription for this product. You can change it from your subscriptions.',
      ); // :45-46
    }
    if (countLive(CUSTOMER_ID) >= MAX_LIVE_SUBSCRIPTIONS_PER_CUSTOMER) {
      return refuseOne(
        'SkuId',
        'SubscriptionLimitReached',
        'You have reached the limit of live subscriptions. Cancel one to start another.',
      ); // :48-49
    }
    try {
      const created = terms(); // :54-59
      const quote = await quoteTerms(request, skuId, quantity ?? 1, created.fulfilment, addressId, branchId, created.paymentMethod);
      const refusal = termsRefusal(quote, created.paymentMethod); // :64-66
      if (refusal) return refuseOne(refusal.property, refusal.code, refusal.message);
      const sub = startSubscription({
        customerId: CUSTOMER_ID,
        skuId,
        terms: created,
        firstDeliveryOn: typeof firstDeliveryOn === 'string' ? firstDeliveryOn : null,
      }); // :71-77 (InvalidFirstDeliveryDate, property FirstDeliveryOn)
      return HttpResponse.json(subscriptionViewOf(sub), {
        status: 201,
        headers: { Location: `/api/customers/me/subscriptions/${sub.id}` },
      });
    } catch (error) {
      if (error instanceof ScheduleViolation) return violationResponse(error);
      throw error;
    }
  }),

  // C7: PUT {id}/terms (CustomerSubscriptionsController.cs:109-120; handler :88-139).
  http.put(`${API}/:id/terms`, async ({ request, params }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const id = String(params.id);
    const body = await readBody(request);
    if (!body) return bindingError('request');
    const parsed = parseFulfilmentAndPayment(body);
    if (!parsed.ok) return parsed.response;
    const version = intFrom(body.version);
    const { quantity, interval, addressId, branchId, terms } = termsFrom(body, parsed.fulfilment, parsed.payment);

    // Validator SubscriptionCommandValidators.cs:34-39.
    const problems = termsShapeProblems(quantity, interval, parsed.fulfilment, addressId, branchId);
    if (version === null || version < 0) {
      problems.unshift({
        propertyName: 'ExpectedVersion',
        errorCode: 'GreaterThanOrEqualValidator',
        errorMessage: "'Expected Version' must be greater than or equal to '0'.",
      });
    }
    if (problems.length > 0) return refuse(problems);

    if (!GUID.test(id)) return notFound();
    const sub = findOwnSubscription(CUSTOMER_ID, id);
    if (!sub) return notFound(); // :99-102
    if (sub.version !== version) {
      return refuseOne('ExpectedVersion', 'StaleVersion', 'This subscription was changed elsewhere. Reload it and try again.', 409); // :104-105
    }
    try {
      const next = terms(); // :107-115
      const quote = await quoteTerms(request, sub.skuId, quantity ?? 1, next.fulfilment, addressId, branchId, next.paymentMethod);
      // :122-123 only what orders depend on is re-checked: an interval-only change never fails on servability.
      const servabilityChanged = !termsEqual({ ...next, intervalWeeks: sub.terms.intervalWeeks }, sub.terms);
      const refusal = servabilityChanged ? termsRefusal(quote, next.paymentMethod) : null;
      if (refusal) return refuseOne(refusal.property, refusal.code, refusal.message);
      const outcome = changeTermsOf(sub, next); // :128 NoChangeRequested, InvalidSubscriptionTransition
      return HttpResponse.json(changeResultOf(sub, outcome));
    } catch (error) {
      if (error instanceof ScheduleViolation) return violationResponse(error);
      throw error;
    }
  }),

  // C8: POST {id}/skip (CustomerSubscriptionsController.cs:122-126).
  http.post(`${API}/:id/skip`, async ({ request, params }) => {
    const body = await readBody(request);
    return ownedChange(String(params.id), request, (sub) => {
      const cycleOn = body?.cycleOn;
      if (typeof cycleOn !== 'string' || !DATE_ONLY.test(cycleOn)) return bindingError('cycleOn');
      return changeResultOf(sub, skipDeliveryOf(sub, cycleOn));
    });
  }),

  // C9: POST {id}/pause (CustomerSubscriptionsController.cs:128-130).
  http.post(`${API}/:id/pause`, ({ request, params }) =>
    ownedChange(String(params.id), request, (sub) => changeResultOf(sub, pauseOf(sub))),
  ),

  // C10: POST {id}/resume (CustomerSubscriptionsController.cs:132-136; handler :168-189). The body is optional.
  http.post(`${API}/:id/resume`, async ({ request, params }) => {
    const text = await request.clone().text();
    const body = text.trim() === '' ? {} : await readBody(request);
    return ownedChange(String(params.id), request, (sub) => {
      if (!body) return bindingError('request');
      const firstDeliveryOn = body.firstDeliveryOn;
      if (firstDeliveryOn != null && (typeof firstDeliveryOn !== 'string' || !DATE_ONLY.test(firstDeliveryOn))) {
        return bindingError('firstDeliveryOn');
      }
      if (sub.status === 'Suspended') {
        // :175-177 SubscriptionSuspendedMessage (SubscriptionMessages.cs:34-37), with the setting's value of 2.
        return refuseOne(
          'SubscriptionId',
          'SubscriptionSuspended',
          sub.suspensionReason === 'UnpaidCycles'
            ? 'This subscription was paused after 2 unpaid orders. Please contact the shop to restart it.'
            : 'This subscription was paused because the product is no longer available. Please contact the shop.',
        );
      }
      if (sub.status === 'Paused' && !isPurchasable(sub.skuId)) {
        return refuseOne('SubscriptionId', 'SkuNotSubscribable', 'This product is not available to subscribe to right now.'); // :180-185
      }
      return changeResultOf(sub, resumeOf(sub, typeof firstDeliveryOn === 'string' ? firstDeliveryOn : null));
    });
  }),

  // C11: POST {id}/cancel (CustomerSubscriptionsController.cs:138-146; validator SubscriptionCommandValidators.cs:58-72).
  http.post(`${API}/:id/cancel`, async ({ request, params }) => {
    const body = await readBody(request);
    return ownedChange(String(params.id), request, (sub) => {
      const reason = parseName(body?.reason, ALL_REASONS);
      if (!reason) {
        return plainError(
          'reason must be one of NoLongerNeeded, TooMuchStock, TastesDidNotSuit, TooExpensive, SwitchingProduct, Other.',
        ); // :141-142
      }
      const note = typeof body?.note === 'string' ? body.note : null;
      const problems: Problem[] = [];
      if (note && note.length > MAX_NOTE_LENGTH) {
        problems.push({
          propertyName: 'Note',
          errorCode: 'MaximumLengthValidator',
          errorMessage: `The length of 'Note' must be ${MAX_NOTE_LENGTH} characters or fewer. You entered ${note.length} characters.`,
        }); // :63
      }
      if (!(CUSTOMER_REASONS as readonly string[]).includes(reason)) {
        problems.push({
          propertyName: 'Reason',
          errorCode: 'PredicateValidator',
          errorMessage: 'is not a reason a customer can choose.',
        }); // :66
      }
      if (problems.length > 0) return refuse(problems);
      return changeResultOf(sub, cancelOf(sub, CUSTOMER_ID, reason, note));
    });
  }),

  // C12: DELETE {id}/pending-changes (CustomerSubscriptionsController.cs:148-152).
  http.delete(`${API}/:id/pending-changes`, ({ request, params }) =>
    ownedChange(String(params.id), request, (sub) => changeResultOf(sub, withdrawPendingOf(sub))),
  ),
];
