import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import * as customer from '@/lib/api/subscriptions';
import * as staff from '@/lib/api/staff-subscriptions';

/**
 * HO-P6 U1: each client function calls exactly the method, path, query and body of its Contract-inventory row.
 * The request is captured at the network layer (MSW), as a real request would carry it.
 */
interface Seen {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

async function capture(run: () => Promise<unknown>, answer: unknown = {}): Promise<Seen> {
  let seen: Seen | undefined;
  server.use(
    http.all('*/api/*', async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      seen = {
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: text ? JSON.parse(text) : undefined,
      };
      return HttpResponse.json(answer as object);
    }),
  );
  await run();
  return seen!;
}

const ID = '5b000000-0000-0000-0000-000000000001';
const SKU = 'b0000000-0000-0000-0000-000000000101';
const BASE = '/api/customers/me/subscriptions';

describe('customer subscription client (C1-C12)', () => {
  it('C1 options: GET options?skuId=', async () => {
    const seen = await capture(() => customer.getSubscriptionOptions(SKU));
    expect(seen).toMatchObject({ method: 'GET', path: `${BASE}/options`, query: { skuId: SKU } });
  });

  it('C2 payment methods: GET payment-methods with only the ids that are given', async () => {
    const seen = await capture(
      () => customer.getSubscriptionPaymentMethods({ skuId: SKU, quantity: 3, deliveryAddressId: ID }),
      [],
    );
    expect(seen).toMatchObject({
      method: 'GET',
      path: `${BASE}/payment-methods`,
      query: { skuId: SKU, quantity: '3', deliveryAddressId: ID },
    });
    expect(seen.query).not.toHaveProperty('pickupBranchId');
  });

  it('C3 list: GET ?status=&pageNumber=&pageSize=', async () => {
    const seen = await capture(() =>
      customer.listMySubscriptions({ status: 'live', pageNumber: 2, pageSize: 5 }),
    );
    expect(seen).toMatchObject({
      method: 'GET',
      path: BASE,
      query: { status: 'live', pageNumber: '2', pageSize: '5' },
    });
  });

  it('C4 detail and C5 cycles', async () => {
    expect(await capture(() => customer.getMySubscription(ID))).toMatchObject({
      method: 'GET',
      path: `${BASE}/${ID}`,
    });
    expect(await capture(() => customer.getMySubscriptionCycles(ID, { pageNumber: 2 }))).toMatchObject({
      method: 'GET',
      path: `${BASE}/${ID}/cycles`,
      query: { pageNumber: '2' },
    });
  });

  it('C6 create: POST with display names, a yyyy-MM-dd date and no firstDeliveryOn when not given', async () => {
    const seen = await capture(() =>
      customer.createSubscription({
        skuId: SKU,
        quantity: 2,
        intervalWeeks: 4,
        fulfilment: 'Delivery',
        deliveryAddressId: ID,
        paymentMethod: 'BankTransfer',
      }),
    );
    expect(seen).toMatchObject({ method: 'POST', path: BASE });
    expect(seen.body).toEqual({
      skuId: SKU,
      quantity: 2,
      intervalWeeks: 4,
      fulfilment: 'Delivery',
      deliveryAddressId: ID,
      paymentMethod: 'BankTransfer',
    });

    const dated = await capture(() =>
      customer.createSubscription({
        skuId: SKU,
        quantity: 1,
        intervalWeeks: 2,
        firstDeliveryOn: '2026-11-20',
        fulfilment: 'Pickup',
        pickupBranchId: ID,
        paymentMethod: 'PayAtPickup',
      }),
    );
    expect(dated.body).toMatchObject({
      firstDeliveryOn: '2026-11-20',
      fulfilment: 'Pickup',
      paymentMethod: 'PayAtPickup',
    });
  });

  it('C7 change terms: PUT {id}/terms with version', async () => {
    const seen = await capture(() =>
      customer.changeSubscriptionTerms(ID, {
        version: 3,
        quantity: 2,
        intervalWeeks: 6,
        fulfilment: 'Delivery',
        deliveryAddressId: ID,
        paymentMethod: 'CashOnDelivery',
      }),
    );
    expect(seen).toMatchObject({ method: 'PUT', path: `${BASE}/${ID}/terms` });
    expect(seen.body).toMatchObject({
      version: 3,
      quantity: 2,
      intervalWeeks: 6,
      paymentMethod: 'CashOnDelivery',
    });
  });

  it('C8 skip, C9 pause', async () => {
    const skip = await capture(() => customer.skipSubscriptionDelivery(ID, '2026-11-24'));
    expect(skip).toMatchObject({
      method: 'POST',
      path: `${BASE}/${ID}/skip`,
      body: { cycleOn: '2026-11-24' },
    });
    const pause = await capture(() => customer.pauseSubscription(ID));
    expect(pause).toMatchObject({ method: 'POST', path: `${BASE}/${ID}/pause` });
    expect(pause.body).toBeUndefined();
  });

  it('C10 resume: the body is an object, with firstDeliveryOn only when chosen', async () => {
    expect((await capture(() => customer.resumeSubscription(ID))).body).toEqual({});
    const dated = await capture(() => customer.resumeSubscription(ID, '2026-12-01'));
    expect(dated).toMatchObject({
      method: 'POST',
      path: `${BASE}/${ID}/resume`,
      body: { firstDeliveryOn: '2026-12-01' },
    });
  });

  it('C11 cancel: the body always has reason; note only when given', async () => {
    const bare = await capture(() => customer.cancelSubscription(ID, { reason: 'TooMuchStock' }));
    expect(bare).toMatchObject({
      method: 'POST',
      path: `${BASE}/${ID}/cancel`,
      body: { reason: 'TooMuchStock' },
    });
    expect(bare.body).not.toHaveProperty('note');
    const noted = await capture(() =>
      customer.cancelSubscription(ID, { reason: 'Other', note: 'Moving away' }),
    );
    expect(noted.body).toEqual({ reason: 'Other', note: 'Moving away' });
  });

  it('C12 withdraw: DELETE {id}/pending-changes', async () => {
    expect(await capture(() => customer.withdrawPendingSubscriptionChanges(ID))).toMatchObject({
      method: 'DELETE',
      path: `${BASE}/${ID}/pending-changes`,
    });
  });
});

describe('staff subscription client (T1-T9)', () => {
  const STAFF = '/api/staff/subscriptions';

  it('T1 list carries the filters and paging', async () => {
    const seen = await capture(() =>
      staff.listStaffSubscriptions({
        status: 'Suspended',
        suspensionReason: 'UnpaidCycles',
        paymentMethod: 'BankTransfer',
        q: 'sam',
        nextDeliveryOn: '2026-11-10',
        sort: '-nextDeliveryOn',
        pageNumber: 2,
        pageSize: 10,
      }),
    );
    expect(seen).toMatchObject({
      method: 'GET',
      path: STAFF,
      query: {
        status: 'Suspended',
        suspensionReason: 'UnpaidCycles',
        paymentMethod: 'BankTransfer',
        q: 'sam',
        nextDeliveryOn: '2026-11-10',
        sort: '-nextDeliveryOn',
        pageNumber: '2',
        pageSize: '10',
      },
    });
  });

  it('T2, T3, T5, T6, T9 read paths', async () => {
    expect(await capture(() => staff.listUnpaidSubscriptions({ pageNumber: 1 }))).toMatchObject({
      path: `${STAFF}/unpaid`,
      query: { pageNumber: '1' },
    });
    expect(await capture(() => staff.getSubscriptionsDueTomorrow())).toMatchObject({
      path: `${STAFF}/due-tomorrow`,
    });
    expect(await capture(() => staff.getStaffSubscription(ID))).toMatchObject({
      path: `${STAFF}/${ID}`,
    });
    expect(await capture(() => staff.getStaffSubscriptionCycles(ID, { pageNumber: 3 }))).toMatchObject({
      path: `${STAFF}/${ID}/cycles`,
      query: { pageNumber: '3' },
    });
    expect(await capture(() => staff.getCustomerSubscriptionSummary(ID))).toMatchObject({
      path: `/api/staff/customers/${ID}/subscriptions`,
    });
  });

  it('T4 csv path carries the filters and no paging', () => {
    const path = staff.subscriptionsCsvPath({
      status: 'Active',
      q: 'oats',
      nextDeliveryOn: '2026-11-10',
      pageNumber: 2,
      pageSize: 50,
    });
    expect(path.startsWith(`${STAFF}/export.csv?`)).toBe(true);
    const query = new URLSearchParams(path.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({ status: 'Active', q: 'oats', nextDeliveryOn: '2026-11-10' });
    expect(staff.subscriptionsCsvPath({})).toBe(`${STAFF}/export.csv`);
  });

  it('T7 reinstate and T8 cancel: bodies', async () => {
    const reinstate = await capture(() => staff.reinstateSubscription(ID, { reason: 'Paid by phone' }));
    expect(reinstate).toMatchObject({
      method: 'POST',
      path: `${STAFF}/${ID}/reinstate`,
      body: { reason: 'Paid by phone' },
    });
    const dated = await capture(() =>
      staff.reinstateSubscription(ID, { reason: 'ok', firstDeliveryOn: '2026-12-02' }),
    );
    expect(dated.body).toEqual({ reason: 'ok', firstDeliveryOn: '2026-12-02' });
    const cancel = await capture(() => staff.staffCancelSubscription(ID, { note: 'Asked by phone' }));
    expect(cancel).toMatchObject({
      method: 'POST',
      path: `${STAFF}/${ID}/cancel`,
      body: { note: 'Asked by phone' },
    });
  });

  it('role constants mirror ActionRoles.Subscriptions.cs', () => {
    expect([...staff.SUBSCRIPTION_VIEW_ROLES]).toEqual([
      'Reception',
      'Inventory',
      'ShopManager',
      'Accountant',
      'Administrator',
    ]);
    expect([...staff.SUBSCRIPTION_MANAGE_ROLES]).toEqual(['ShopManager', 'Administrator']);
    expect([...staff.SUBSCRIPTION_EXPORT_ROLES]).toEqual(['ShopManager', 'Accountant', 'Administrator']);
  });
});
