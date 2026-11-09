import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '@/lib/api/client';
import {
  SUBSCRIPTION_EXPORT_ROLES,
  SUBSCRIPTION_MANAGE_ROLES,
  SUBSCRIPTION_VIEW_ROLES,
  getStaffSubscription,
  getStaffSubscriptionCycles,
  listStaffSubscriptions,
  listUnpaidSubscriptions,
  reinstateSubscription,
  staffCancelSubscription,
  subscriptionsCsvPath,
} from '@/lib/api/staff-subscriptions';
import { apiFetch, getApiUrl } from '@/lib/api/client';
import {
  MOCK_EXPORT_ROLES,
  MOCK_MANAGE_ROLES,
  MOCK_VIEW_ROLES,
  setMockSubscriptionRoles,
} from '../../../mocks/handlers/subscriptions/staff';
import { subscriptionFixtureIds } from '../../../mocks/handlers/subscriptions/fixtures';
import { dueTomorrowOf, findSubscription, setMaxExportRows } from '../../../mocks/handlers/subscriptions/store';
import { findSku } from '../../../mocks/handlers/shop/store';
import { freshStore } from './helpers';

/**
 * U34 -- the staff mock refuses exactly what StaffSubscriptionsController refuses, with the server's status, body shape and codes.
 * Each case cites the server line it mirrors (StaffSubscriptionsController.cs unless another file is named).
 */
const ids = subscriptionFixtureIds;
const UNKNOWN = '5b000000-0000-0000-0000-0000000000ff';
const ALL_ROLES = ['Reception', 'Inventory', 'ShopManager', 'Accountant', 'Administrator', 'Cashier', 'Rider'];

beforeEach(() => freshStore());
afterEach(() => {
  setMockSubscriptionRoles(null);
  setMaxExportRows(null);
});

/** The export is a file, not JSON: read it as the browser would, by status and text. */
async function download(path: string): Promise<{ status: number; text: string }> {
  const response = await fetch(getApiUrl(path), { credentials: 'include' });
  return { status: response.status, text: await response.text() };
}

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  return run().then(
    () => null,
    (error: unknown) => error,
  );
}

const errors = (error: unknown) => (error as ApiValidationError).response.errors as unknown as Array<{ propertyName: string; errorCode: string }>;

describe('U34 roles (ActionRoles.Subscriptions.cs:12-14, ADR-248)', () => {
  it('the mock arrays are the web arrays are the server arrays', () => {
    expect([...MOCK_VIEW_ROLES].sort()).toEqual([...SUBSCRIPTION_VIEW_ROLES].sort());
    expect([...MOCK_MANAGE_ROLES].sort()).toEqual([...SUBSCRIPTION_MANAGE_ROLES].sort());
    expect([...MOCK_EXPORT_ROLES].sort()).toEqual([...SUBSCRIPTION_EXPORT_ROLES].sort());
    expect(SUBSCRIPTION_VIEW_ROLES).toEqual(['Reception', 'Inventory', 'ShopManager', 'Accountant', 'Administrator']);
    expect(SUBSCRIPTION_MANAGE_ROLES).toEqual(['ShopManager', 'Administrator']);
    expect(SUBSCRIPTION_EXPORT_ROLES).toEqual(['ShopManager', 'Accountant', 'Administrator']);
  });

  const reads: Array<[string, () => Promise<unknown>]> = [
    ['T1 list :26', () => listStaffSubscriptions()],
    ['T2 unpaid :42', () => listUnpaidSubscriptions()],
    ['T5 detail :79', () => getStaffSubscription(ids.others.active)],
    ['T6 cycles :92', () => getStaffSubscriptionCycles(ids.others.active)],
  ];
  it.each(reads)('%s needs Subscriptions.View: a 403 for every other role', async (_name, run) => {
    for (const role of ALL_ROLES) {
      setMockSubscriptionRoles([role]);
      const error = await failure(run);
      if (SUBSCRIPTION_VIEW_ROLES.includes(role)) expect(error, role).toBeNull();
      else expect(error, role).toBeInstanceOf(ApiForbiddenError);
    }
  });

  it('T7 reinstate :104 and T8 cancel :118 need Subscriptions.Manage', async () => {
    for (const role of ALL_ROLES) {
      setMockSubscriptionRoles([role]);
      const allowed = SUBSCRIPTION_MANAGE_ROLES.includes(role);
      const reinstate = await failure(() => reinstateSubscription(ids.others.suspendedUnpaid, { reason: 'ok' }));
      const cancel = await failure(() => staffCancelSubscription(ids.others.paused, { note: 'ok' }));
      if (allowed) {
        expect(reinstate, role).toBeNull();
        expect(cancel, role).toBeNull();
        freshStore();
      } else {
        expect(reinstate, role).toBeInstanceOf(ApiForbiddenError);
        expect(cancel, role).toBeInstanceOf(ApiForbiddenError);
      }
    }
  });

  it('T4 export :62 needs Subscriptions.Export (an Accountant exports but cannot manage)', async () => {
    for (const role of ALL_ROLES) {
      setMockSubscriptionRoles([role]);
      const { status } = await download(subscriptionsCsvPath());
      expect(status, role).toBe(SUBSCRIPTION_EXPORT_ROLES.includes(role) ? 200 : 403);
    }
  });
});

describe('U34 filters: the controller\'s plain { error } 400 (:143-145), checked before paging', () => {
  it.each([
    ['status', { status: 'Dormant' }, 'status is not a subscription status.'],
    ['suspensionReason', { suspensionReason: 'Boredom' }, 'suspensionReason is not a suspension reason.'],
    ['paymentMethod', { paymentMethod: 'Barter' }, 'paymentMethod is not a payment method.'],
    ['nextDeliveryOn', { nextDeliveryOn: '2026-02-31' }, 'nextDeliveryOn must be yyyy-MM-dd.'],
    ['nextDeliveryOn (text)', { nextDeliveryOn: 'tomorrow' }, 'nextDeliveryOn must be yyyy-MM-dd.'],
  ])('a bad %s is 400 { error }, with no errors array', async (_name, filters, message) => {
    const error = await failure(() => listStaffSubscriptions(filters as never));
    expect(error).toBeInstanceOf(ApiValidationError);
    expect((error as ApiValidationError).response).toEqual({ error: message });
    const exported = await download(subscriptionsCsvPath(filters as never));
    expect(exported.status).toBe(400);
    expect(JSON.parse(exported.text)).toEqual({ error: message });
  });

  it('matches an enumeration by display name, whatever its case, and a blank is no filter', async () => {
    const page = await listStaffSubscriptions({ status: 'suspended' as never, paymentMethod: 'banktransfer' as never });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((i) => i.status === 'Suspended' && i.paymentMethod === 'BankTransfer')).toBe(true);
    const blank = await apiFetch<{ totalCount: number }>('/api/staff/subscriptions?status=&suspensionReason=');
    expect(blank.totalCount).toBe((await listStaffSubscriptions()).totalCount);
  });

  it('nextDeliveryOn keeps only subscriptions whose next delivery is that day, in the list and the export', async () => {
    const { dueOn } = dueTomorrowOf();
    const page = await listStaffSubscriptions({ nextDeliveryOn: dueOn });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((i) => i.nextDeliveryOn === dueOn)).toBe(true);
    const active = await listStaffSubscriptions({ status: 'Active', nextDeliveryOn: dueOn });
    expect(active.totalCount).toBe(dueTomorrowOf().count);
    const exported = await download(subscriptionsCsvPath({ status: 'Active', nextDeliveryOn: dueOn }));
    expect(exported.text.trim().split(/\r?\n/).length - 1).toBe(active.totalCount);
    const none = await listStaffSubscriptions({ nextDeliveryOn: '2001-01-01' });
    expect(none.totalCount).toBe(0);
  });

  it('an unknown sort is the default, never a 400 (SubscriptionStaffQueryHandlers.cs:37-43)', async () => {
    const odd = await apiFetch<{ items: Array<{ id: string }> }>('/api/staff/subscriptions?sort=colour');
    const normal = await listStaffSubscriptions();
    expect(odd.items.map((i) => i.id)).toEqual(normal.items.map((i) => i.id));
  });

  it('sorts as the server does: soonest first with none last; -nextDeliveryOn reverses; status; product', async () => {
    const soonest = (await listStaffSubscriptions({ pageSize: 100 })).items;
    const dates = soonest.map((i) => i.nextDeliveryOn);
    const firstNull = dates.indexOf(null);
    expect(dates.slice(0, firstNull).every((d, i, all) => i === 0 || all[i - 1]! <= d!)).toBe(true);
    expect(dates.slice(firstNull).every((d) => d === null)).toBe(true);
    const latest = (await listStaffSubscriptions({ sort: '-nextDeliveryOn', pageSize: 100 })).items;
    expect(latest[0]!.nextDeliveryOn).toBeNull(); // Postgres sorts NULLs first descending
    const byStatus = (await listStaffSubscriptions({ sort: 'status', pageSize: 100 })).items.map((i) => i.status);
    expect(byStatus.indexOf('Cancelled')).toBeGreaterThan(byStatus.lastIndexOf('Suspended'));
    expect(byStatus.indexOf('Active')).toBe(0);
    const names = (await listStaffSubscriptions({ sort: 'product', pageSize: 100 })).items.map((i) => i.product.productName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('q matches product, customer name or mobile, case-insensitively, and the product name as subscribed', async () => {
    const byProduct = await listStaffSubscriptions({ q: 'HONEY' });
    expect(byProduct.items.length).toBeGreaterThan(0);
    const byCustomer = await listStaffSubscriptions({ q: 'shirin' });
    expect(byCustomer.items.every((i) => i.customer.name === 'Shirin Akter')).toBe(true);
    const byMobile = await listStaffSubscriptions({ q: '0171200000' });
    expect(byMobile.items.length).toBeGreaterThan(1);
    expect((await listStaffSubscriptions({ q: 'zzz-nothing' })).totalCount).toBe(0);
  });
});

describe('U34 paging (PagingHelper.cs:31-47)', () => {
  it('a page size of 0 or less is 400 InvalidPageSize; a page number above 1,000,000 is 400 InvalidPageNumber', async () => {
    const size = await failure(() => listStaffSubscriptions({ pageSize: 0 }));
    expect(errors(size)[0]).toMatchObject({ propertyName: 'pageSize', errorCode: 'InvalidPageSize' });
    const number = await failure(() => listUnpaidSubscriptions({ pageNumber: 1_000_001 }));
    expect(errors(number)[0]).toMatchObject({ propertyName: 'pageNumber', errorCode: 'InvalidPageNumber' });
  });

  it('a larger page size is clamped to 100; the default is 20', async () => {
    expect((await listStaffSubscriptions({ pageSize: 5000 })).pageSize).toBe(100);
    expect((await listStaffSubscriptions()).pageSize).toBe(20);
  });
});

describe('U34 export (:69)', () => {
  it('answers 413 { error } above the cap and the CSV (12 columns, quoted) below it', async () => {
    setMaxExportRows(2);
    const refused = await download(subscriptionsCsvPath());
    expect(refused.status).toBe(413);
    expect(JSON.parse(refused.text)).toEqual({ error: 'Too many rows to export. Narrow the filters.' });

    setMaxExportRows(null);
    const { status, text } = await download(subscriptionsCsvPath({ status: 'Suspended' }));
    expect(status).toBe(200);
    const lines = text.trim().split(/\r?\n/);
    expect(lines[0]).toBe(
      '"SubscriptionId","Customer","Mobile","Product","Variant","Quantity","IntervalWeeks","Status","SuspensionReason","NextDeliveryOn","PaymentMethod","UnpaidStreak"',
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]!.split('","')).toHaveLength(12);
  });
});

describe('U34 404 and the rule codes', () => {
  it('an unknown subscription is a 404 with no body on T5 (:84), T6 (:99), T7 and T8', async () => {
    for (const run of [
      () => getStaffSubscription(UNKNOWN),
      () => getStaffSubscriptionCycles(UNKNOWN),
      () => reinstateSubscription(UNKNOWN, { reason: 'ok' }),
      () => staffCancelSubscription(UNKNOWN, { note: 'ok' }),
    ]) {
      expect(await failure(run)).toBeInstanceOf(ApiNotFoundError);
    }
    expect(await failure(() => getStaffSubscription('not-a-guid'))).toBeInstanceOf(ApiNotFoundError);
  });

  it('the validator runs before the handler: an empty reason on an unknown id is 400, not 404 (SubscriptionCommandValidators.cs:104)', async () => {
    const error = await failure(() => reinstateSubscription(UNKNOWN, { reason: '   ' }));
    expect(errors(error)[0]).toMatchObject({ propertyName: 'Reason', errorCode: 'ReinstatementReasonRequired' });
  });

  it('reinstate: reason required and at most 500; only a suspended one; the date is checked by the aggregate', async () => {
    const tooLong = await failure(() => reinstateSubscription(ids.others.suspendedUnpaid, { reason: 'x'.repeat(501) }));
    expect(errors(tooLong)[0]).toMatchObject({ propertyName: 'Reason' });
    const active = await failure(() => reinstateSubscription(ids.others.active, { reason: 'ok' }));
    expect(errors(active)[0]).toMatchObject({ errorCode: 'SubscriptionCannotBeReinstated' });
    const badDate = await failure(() => reinstateSubscription(ids.others.suspendedUnpaid, { reason: 'ok', firstDeliveryOn: '2099-01-01' }));
    expect(errors(badDate)[0]).toMatchObject({ propertyName: 'FirstDeliveryOn', errorCode: 'InvalidFirstDeliveryDate' });
    // Nothing above changed it.
    expect(findSubscription(ids.others.suspendedUnpaid)!.status).toBe('Suspended');
  });

  it('reinstate answers the plain view (no staff fields) with the subscription Active; the staff detail records it', async () => {
    const view = (await reinstateSubscription(ids.others.suspendedUnpaid, { reason: '  Paid in cash  ' })) as unknown as Record<string, unknown>;
    expect(view.status).toBe('Active');
    expect(view).not.toHaveProperty('customer');
    expect(view).not.toHaveProperty('allowedStaffActions');
    const detail = await getStaffSubscription(ids.others.suspendedUnpaid);
    expect(detail.reinstatement).toMatchObject({ reason: 'Paid in cash' });
    expect(detail.allowedStaffActions).toEqual(['Cancel']);
  });

  it('reinstate refuses SkuNotSubscribable while the product cannot be bought (SubscriptionWorkerCommandHandlers.cs:160-165)', async () => {
    const sku = findSku(findSubscription(ids.others.suspendedUnpaid)!.skuId)!.sku;
    const was = sku.inStock;
    sku.inStock = false;
    try {
      const error = await failure(() => reinstateSubscription(ids.others.suspendedUnpaid, { reason: 'ok' }));
      expect(errors(error)[0]).toMatchObject({ propertyName: 'SubscriptionId', errorCode: 'SkuNotSubscribable' });
    } finally {
      sku.inStock = was;
    }
  });

  it('cancel: a note is required (:69-70) and at most 500 (:63); a cancelled one cannot be cancelled again', async () => {
    const empty = await failure(() => staffCancelSubscription(ids.others.active, { note: '  ' }));
    expect(errors(empty)[0]).toMatchObject({ propertyName: 'Note', errorCode: 'CancellationReasonRequired' });
    const tooLong = await failure(() => staffCancelSubscription(ids.others.active, { note: 'x'.repeat(501) }));
    expect(errors(tooLong)[0]).toMatchObject({ propertyName: 'Note' });
    const again = await failure(() => staffCancelSubscription(ids.others.cancelled, { note: 'ok' }));
    expect(errors(again)[0]).toMatchObject({ errorCode: 'InvalidSubscriptionTransition' });
  });

  it('cancel always records StaffCancelled and the note, and answers the plain view', async () => {
    const view = (await staffCancelSubscription(ids.others.active, { note: ' Moving ' })) as unknown as Record<string, unknown>;
    expect(view.status).toBe('Cancelled');
    expect(view).not.toHaveProperty('customer');
    const detail = await getStaffSubscription(ids.others.active);
    expect(detail).toMatchObject({ cancellationReason: 'StaffCancelled', cancellationNote: 'Moving', allowedStaffActions: [] });
  });
});

describe('U34 review fixes', () => {
  it('a non-GUID id is a 404 before the role check (no route matches), for every verb', async () => {
    setMockSubscriptionRoles(['Cashier']);
    for (const run of [
      () => getStaffSubscription('not-a-guid'),
      () => getStaffSubscriptionCycles('not-a-guid'),
      () => reinstateSubscription('not-a-guid', { reason: 'ok' }),
      () => staffCancelSubscription('not-a-guid', { note: 'ok' }),
    ]) {
      expect(await failure(run)).toBeInstanceOf(ApiNotFoundError);
    }
    // A real id still meets the role check.
    expect(await failure(() => getStaffSubscription(ids.others.active))).toBeInstanceOf(ApiForbiddenError);
  });

  it("a blank reinstate reason carries FluentValidation's default text with the code the validator sets (SubscriptionCommandValidators.cs:104)", async () => {
    const error = await failure(() => reinstateSubscription(ids.others.suspendedUnpaid, { reason: ' ' }));
    expect((error as ApiValidationError).response.errors?.[0]).toMatchObject({
      propertyName: 'Reason',
      errorCode: 'ReinstatementReasonRequired',
      errorMessage: "'Reason' must not be empty.",
    });
  });
});
