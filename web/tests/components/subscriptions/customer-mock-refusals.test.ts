import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiFetch, ApiConflictError, ApiNotFoundError, ApiUnauthorizedError, ApiValidationError } from '@/lib/api/client';
import {
  cancelSubscription,
  changeSubscriptionTerms,
  createSubscription,
  getMySubscription,
  getMySubscriptionCycles,
  getSubscriptionOptions,
  getSubscriptionPaymentMethods,
  listMySubscriptions,
  pauseSubscription,
  resumeSubscription,
  skipSubscriptionDelivery,
  withdrawPendingSubscriptionChanges,
  type CreateSubscriptionInput,
} from '@/lib/api/subscriptions';
import { seedDates, subscriptionFixtureIds } from '@/mocks/handlers/subscriptions/fixtures';
import { db, resetSubscriptionsMockData } from '@/mocks/handlers/subscriptions/store';

/**
 * HO-P6 S1 U26: the customer mock refuses exactly as the server does (ADR-FE-185). One case per refusal of §11.2.10: the
 * status, the code, the property and the body shape (both 400 shapes, the bodiless 404, the 409) equal the server's. Each
 * case names the server file:line it mirrors (the mock's own comments carry the same lines).
 */

const mine = subscriptionFixtureIds.mine;
const others = subscriptionFixtureIds.others;
const skus = subscriptionFixtureIds.skus;
const home = subscriptionFixtureIds.addresses.samHome;
const dates = seedDates();
const GHOST = '5b000000-0000-0000-0000-00000000dead';

beforeEach(() => {
  resetSubscriptionsMockData();
  document.cookie = 'pc_session=test; path=/';
  serveAddresses([{ id: home, district: 'Dhaka', postalCode: '1209' }]);
});
afterEach(() => {
  document.cookie = 'pc_session=; path=/; max-age=0';
});

function serveAddresses(list: Array<{ id: string; district: string; postalCode: string | null }>) {
  server.use(
    http.get('*/api/customers/me/addresses', () =>
      HttpResponse.json({
        addresses: list.map((a) => ({ ...a, label: 'Home', line1: 'House 1', line2: null, city: 'Dhaka', isDefault: true })),
        maxAddresses: 10,
      }),
    ),
  );
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to be refused');
}

async function refusal(promise: Promise<unknown>) {
  const error = await rejection(promise);
  if (!(error instanceof ApiValidationError) && !(error instanceof ApiConflictError)) throw error;
  return error.response as unknown as { error?: string; errors?: Array<{ propertyName: string; errorCode: string; errorMessage: string }> };
}

const create = (overrides: Partial<CreateSubscriptionInput> = {}): CreateSubscriptionInput => ({
  skuId: skus.honey,
  quantity: 1,
  intervalWeeks: 4,
  fulfilment: 'Delivery',
  deliveryAddressId: home,
  paymentMethod: 'BankTransfer',
  ...overrides,
});

describe('reads (CustomerSubscriptionsController.cs:28-86)', () => {
  it('answers 401 without a customer session', async () => {
    document.cookie = 'pc_session=; path=/; max-age=0';
    expect(await rejection(listMySubscriptions())).toBeInstanceOf(ApiUnauthorizedError);
  });

  it('C1: an unknown SKU is a 404 with no body (:34)', async () => {
    expect(await rejection(getSubscriptionOptions(GHOST))).toBeInstanceOf(ApiNotFoundError);
  });

  it('C2: [] with neither id (SubscriptionCustomerQueryHandlers.cs:117); a delivery lists cash on delivery and bank transfer; an unknown SKU is a 404 (:114)', async () => {
    expect(await getSubscriptionPaymentMethods({ skuId: skus.honey })).toEqual([]);
    const methods = await getSubscriptionPaymentMethods({ skuId: skus.honey, deliveryAddressId: home });
    expect(methods.map((m) => m.method)).toEqual(['CashOnDelivery', 'BankTransfer']);
    const pickup = await getSubscriptionPaymentMethods({
      skuId: skus.honey,
      pickupBranchId: subscriptionFixtureIds.mainBranchId,
    });
    expect(pickup.map((m) => m.method)).toEqual(['BankTransfer', 'PayAtPickup']);
    expect(await rejection(getSubscriptionPaymentMethods({ skuId: GHOST, deliveryAddressId: home }))).toBeInstanceOf(ApiNotFoundError);
  });

  it('C2: cash on delivery above the ordering mock\'s ceiling stays listed, unavailable, with Orders\' reason text', async () => {
    const methods = await getSubscriptionPaymentMethods({ skuId: skus.masala750, quantity: 2, deliveryAddressId: home });
    const cash = methods.find((m) => m.method === 'CashOnDelivery')!;
    expect(cash.isAvailable).toBe(false);
    expect(cash.unavailableReason).toMatch(/Cash on delivery is available for orders up to/);
    expect(methods.find((m) => m.method === 'BankTransfer')!.isAvailable).toBe(true);
  });

  it('C3: a bad status is the plain { error } 400 with no errors array (:56)', async () => {
    const body = await refusal(listMySubscriptions({ status: 'bogus' as never }));
    expect(body).toEqual({ error: 'status must be live or cancelled.' });
    expect(body.errors).toBeUndefined();
  });

  it('C3: paging refusals are ValidationResponses with the paging codes (PagingHelper.cs:31-47); live and cancelled split', async () => {
    const size = await refusal(listMySubscriptions({ pageSize: 0 }));
    expect(size.errors?.[0]).toMatchObject({ errorCode: 'InvalidPageSize', propertyName: 'pageSize' });
    const page = await refusal(listMySubscriptions({ pageNumber: 1_000_001 }));
    expect(page.errors?.[0]).toMatchObject({ errorCode: 'InvalidPageNumber' });

    const live = await listMySubscriptions({ status: 'live', pageSize: 100 });
    const cancelled = await listMySubscriptions({ status: 'cancelled' });
    expect(live.totalCount).toBe(7);
    expect(cancelled.items.map((s) => s.id)).toEqual([mine.cancelled]);
    // Not cancelled first, then by next delivery with the ones without a date last.
    const dated = live.items.filter((s) => s.nextDeliveryOn).map((s) => s.nextDeliveryOn!);
    expect(dated).toEqual([...dated].sort());
    expect(live.items.slice(0, dated.length).every((s) => s.nextDeliveryOn)).toBe(true);
  });

  it("C4/C5: another customer's subscription, an unknown id and a malformed id are the same bodiless 404 (ADR-248)", async () => {
    for (const id of [others.active, GHOST, 'not-a-guid']) {
      expect(await rejection(getMySubscription(id))).toBeInstanceOf(ApiNotFoundError);
      expect(await rejection(getMySubscriptionCycles(id))).toBeInstanceOf(ApiNotFoundError);
    }
    const detail = await getMySubscription(mine.activeUnlocked);
    expect(detail.cycles.length).toBeGreaterThan(0);
  });
});

describe('C6 create (CustomerSubscriptionsController.cs:88-107; SubscriptionCustomerCommandHandlers.cs:33-83)', () => {
  it('a bad fulfilment or payment method is the plain { error } 400 (:180, :186)', async () => {
    expect(await refusal(apiFetch('/api/customers/me/subscriptions', { method: 'POST', body: { ...create(), fulfilment: 'Courier' } }))).toEqual({
      error: 'fulfilment must be Delivery or Pickup.',
    });
    expect(await refusal(apiFetch('/api/customers/me/subscriptions', { method: 'POST', body: { ...create(), paymentMethod: 'Card' } }))).toEqual({
      error: 'paymentMethod must be CashOnDelivery, BankTransfer or PayAtPickup.',
    });
    expect(await refusal(apiFetch('/api/customers/me/subscriptions', { method: 'POST', body: { ...create(), paymentMethod: '' } }))).toHaveProperty('error');
  });

  it('the validator reports every broken rule at once, with the server\'s property names (SubscriptionCommandValidators.cs:23-26)', async () => {
    const body = await refusal(
      createSubscription(create({ quantity: 0, intervalWeeks: 3, deliveryAddressId: undefined, pickupBranchId: subscriptionFixtureIds.mainBranchId })),
    );
    expect(body.errors?.map((e) => e.propertyName).sort()).toEqual(['Fulfilment', 'IntervalWeeks', 'Quantity']);
    expect(body.errors?.find((e) => e.propertyName === 'IntervalWeeks')?.errorMessage).toBe('is not an allowed interval.');
  });

  it('an unknown SKU is a 404 (:39-40)', async () => {
    expect(await rejection(createSubscription(create({ skuId: GHOST })))).toBeInstanceOf(ApiNotFoundError);
  });

  it('a product that is not offered, or cannot be bought, is SkuNotSubscribable with the two server texts (:42-43)', async () => {
    const notOffered = await refusal(createSubscription(create({ skuId: '00000000-0000-0000-0000-000000000000' })));
    expect(notOffered.errors?.[0]).toMatchObject({ propertyName: 'SkuId' });
    const kit = await refusal(createSubscription(create({ skuId: await sku('breakfast-starter-kit') })));
    expect(kit.errors?.[0]).toMatchObject({
      errorCode: 'SkuNotSubscribable',
      errorMessage: 'This product is not offered as a subscription.',
    });
    const outOfStock = await refusal(createSubscription(create({ skuId: skus.oats4kg })));
    expect(outOfStock.errors?.[0]).toMatchObject({
      errorCode: 'SkuNotSubscribable',
      errorMessage: 'This product is not available to subscribe to right now.',
    });
  });

  it('a second live subscription to the same SKU is SubscriptionAlreadyExists (:45-46); the 21st is SubscriptionLimitReached (:48-49)', async () => {
    const again = await refusal(createSubscription(create({ skuId: skus.oats400 })));
    expect(again.errors?.[0]).toMatchObject({ errorCode: 'SubscriptionAlreadyExists', propertyName: 'SkuId' });

    const template = db.subscriptions.find((s) => s.id === mine.activeUnlocked)!;
    while (db.subscriptions.filter((s) => s.customerId === template.customerId && s.status !== 'Cancelled').length < 20) {
      db.subscriptions.push({ ...template, id: crypto.randomUUID(), skuId: crypto.randomUUID() });
    }
    const limit = await refusal(createSubscription(create()));
    expect(limit.errors?.[0]).toMatchObject({ errorCode: 'SubscriptionLimitReached', propertyName: 'SkuId' });
  });

  it('Orders\' servability codes map to the server\'s properties (SubscriptionHandlerSupport.cs:66-91)', async () => {
    const missing = await refusal(createSubscription(create({ deliveryAddressId: GHOST })));
    expect(missing.errors?.[0]).toMatchObject({ errorCode: 'DeliveryAddressNotFound', propertyName: 'DeliveryAddressId' });

    serveAddresses([{ id: home, district: 'Gazipur', postalCode: null }]);
    const outside = await refusal(createSubscription(create()));
    expect(outside.errors?.[0]).toMatchObject({ errorCode: 'AddressOutsideServedZones', propertyName: 'DeliveryAddressId' });

    serveAddresses([{ id: home, district: 'Dhaka', postalCode: '1209' }]);
    const branch = await refusal(
      createSubscription(create({ fulfilment: 'Pickup', deliveryAddressId: undefined, pickupBranchId: GHOST, paymentMethod: 'PayAtPickup' })),
    );
    expect(branch.errors?.[0]).toMatchObject({ errorCode: 'PickupBranchUnavailable', propertyName: 'PickupBranchId' });

    const cash = await refusal(createSubscription(create({ skuId: skus.masala750, quantity: 2, paymentMethod: 'CashOnDelivery' })));
    expect(cash.errors?.[0]).toMatchObject({ errorCode: 'PaymentMethodUnavailable', propertyName: 'PaymentMethod' });
    expect(cash.errors?.[0]?.errorMessage).toMatch(/Cash on delivery is available for orders up to/);

    const wrongMethod = await refusal(createSubscription(create({ paymentMethod: 'PayAtPickup' })));
    expect(wrongMethod.errors?.[0]).toMatchObject({ errorCode: 'PaymentMethodNotAllowedForFulfilment', propertyName: 'PaymentMethod' });
  });

  it('a first delivery before the earliest is InvalidFirstDeliveryDate on FirstDeliveryOn; a good one is a 201 with the view', async () => {
    const early = await refusal(createSubscription(create({ firstDeliveryOn: dates.today })));
    expect(early.errors?.[0]).toMatchObject({ errorCode: 'InvalidFirstDeliveryDate', propertyName: 'FirstDeliveryOn' });

    const view = await createSubscription(create({ firstDeliveryOn: dates.latestFirstDeliveryOn }));
    expect(view).toMatchObject({ status: 'Active', nextDeliveryOn: dates.latestFirstDeliveryOn, version: 1 });
    expect(view.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect('cycles' in view).toBe(false);
    expect((await getSubscriptionOptions(skus.honey)).existingSubscriptionId).toBe(view.id);
  });
});

async function sku(slug: string): Promise<string> {
  const { seedProducts } = await import('@/mocks/handlers/shop/fixtures');
  return seedProducts().find((p) => p.slug === slug)!.skus[0]!.skuId;
}

describe('C7 to C12 changes (CustomerSubscriptionsController.cs:109-152)', () => {
  const terms = (version: number, quantity: number) => ({
    version,
    quantity,
    intervalWeeks: 4,
    fulfilment: 'Delivery' as const,
    deliveryAddressId: home,
    paymentMethod: 'CashOnDelivery' as const,
  });

  it('C7: another customer\'s id is a 404; a stale version is a 409 StaleVersion (:104-105); the same terms are NoChangeRequested', async () => {
    expect(await rejection(changeSubscriptionTerms(others.active, terms(1, 2)))).toBeInstanceOf(ApiNotFoundError);
    const stale = await rejection(changeSubscriptionTerms(mine.activeUnlocked, terms(7, 3)));
    expect(stale).toBeInstanceOf(ApiConflictError);
    expect((stale as ApiConflictError).response?.errors?.[0]).toMatchObject({ errorCode: 'StaleVersion', propertyName: 'ExpectedVersion' });

    const same = await refusal(changeSubscriptionTerms(mine.activeUnlocked, terms(1, 2)));
    expect(same.errors?.[0]).toMatchObject({ errorCode: 'NoChangeRequested' });

    const done = await changeSubscriptionTerms(mine.activeUnlocked, terms(1, 3));
    expect(done.appliedImmediately).toBe(true);
    expect(done.message).toMatch(/^Done\. Your next delivery on .* will be 3 × Organic Rolled Oats 400 g\.$/);
    expect(done.subscription.version).toBe(2);
  });

  it('C7: a suspended subscription cannot be changed; an interval-only change skips the servability re-check (:121-123)', async () => {
    const suspended = await refusal(changeSubscriptionTerms(mine.suspendedUnpaid, { ...terms(1, 1), paymentMethod: 'BankTransfer', intervalWeeks: 4 }));
    expect(suspended.errors?.[0]).toMatchObject({ errorCode: 'InvalidSubscriptionTransition' });

    // The address is no longer served, but only the interval changes: still accepted.
    serveAddresses([{ id: home, district: 'Gazipur', postalCode: null }]);
    const result = await changeSubscriptionTerms(mine.activeUnlocked, { ...terms(1, 2), intervalWeeks: 6 });
    expect(result.subscription.terms.intervalWeeks).toBe(6);
  });

  it('C8: a date that cannot be skipped names the next one that can; a second skip is SkipAlreadyScheduled; a malformed date is a model-binding 400', async () => {
    const wrong = await refusal(skipSubscriptionDelivery(mine.activeUnlocked, dates.today));
    expect(wrong.errors?.[0]).toMatchObject({ errorCode: 'CycleNoLongerSkippable', propertyName: 'CycleOn' });
    expect(wrong.errors?.[0]?.errorMessage).toMatch(/can no longer be skipped\. You can skip the one on /);

    const bad = await refusal(skipSubscriptionDelivery(mine.activeUnlocked, 'soon'));
    expect(bad.errors).toEqual(expect.not.arrayContaining([expect.objectContaining({ errorCode: expect.any(String) })]));

    const skipped = await skipSubscriptionDelivery(mine.activeUnlocked, dates.unlockedNextDeliveryOn);
    expect(skipped.message).toMatch(/^Done\. That delivery is skipped\. Your next delivery is on /);
  });

  it('C9/C10: pause refuses a suspended one; resume refuses a suspension with the server sentence, and an active one', async () => {
    expect((await refusal(pauseSubscription(mine.suspendedUnpaid))).errors?.[0]).toMatchObject({ errorCode: 'InvalidSubscriptionTransition' });
    const suspended = await refusal(resumeSubscription(mine.suspendedUnpaid));
    expect(suspended.errors?.[0]).toMatchObject({ errorCode: 'SubscriptionSuspended', propertyName: 'SubscriptionId' });
    expect(suspended.errors?.[0]?.errorMessage).toBe(
      'This subscription was paused after 2 unpaid orders. Please contact the shop to restart it.',
    );
    expect((await refusal(resumeSubscription(mine.activeUnlocked))).errors?.[0]).toMatchObject({ errorCode: 'InvalidSubscriptionTransition' });

    const paused = await resumeSubscription(mine.paused, dates.latestFirstDeliveryOn);
    expect(paused.subscription.nextDeliveryOn).toBe(dates.latestFirstDeliveryOn);
    resetSubscriptionsMockData();
    const early = await refusal(resumeSubscription(mine.paused, dates.today));
    expect(early.errors?.[0]).toMatchObject({ errorCode: 'InvalidFirstDeliveryDate', propertyName: 'FirstDeliveryOn' });
  });

  it('C11: a missing or unknown reason is the plain { error } 400 (:141-142); a staff reason and a long note are ValidationResponses (SubscriptionCommandValidators.cs:63-66)', async () => {
    const missing = await refusal(apiFetch(`/api/customers/me/subscriptions/${mine.activeUnlocked}/cancel`, { method: 'POST', body: {} }));
    expect(missing.error).toMatch(/^reason must be one of NoLongerNeeded/);
    expect(missing.errors).toBeUndefined();

    const staffReason = await refusal(
      apiFetch(`/api/customers/me/subscriptions/${mine.activeUnlocked}/cancel`, { method: 'POST', body: { reason: 'StaffCancelled' } }),
    );
    expect(staffReason.errors?.[0]).toMatchObject({ propertyName: 'Reason', errorMessage: 'is not a reason a customer can choose.' });

    const long = await refusal(cancelSubscription(mine.activeUnlocked, { reason: 'Other', note: 'x'.repeat(501) }));
    expect(long.errors?.[0]).toMatchObject({ propertyName: 'Note', errorCode: 'MaximumLengthValidator' });

    const done = await cancelSubscription(mine.activeUnlocked, { reason: 'TooExpensive', note: '<b>dear</b>' });
    expect(done).toMatchObject({ appliedImmediately: true, message: 'Done. Your subscription is cancelled.' });
    expect((await refusal(cancelSubscription(mine.activeUnlocked, { reason: 'Other' }))).errors?.[0]).toMatchObject({
      errorCode: 'InvalidSubscriptionTransition',
    });
  });

  it('C12: nothing pending is NoPendingChange; pending terms are withdrawn', async () => {
    expect((await refusal(withdrawPendingSubscriptionChanges(mine.activeUnlocked))).errors?.[0]).toMatchObject({ errorCode: 'NoPendingChange' });
    const result = await withdrawPendingSubscriptionChanges(mine.activeLocked);
    expect(result.message).toBe('Done. The scheduled change has been withdrawn.');
    expect(result.subscription.pending).toBeNull();
  });
});
