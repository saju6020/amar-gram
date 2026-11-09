import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '@/lib/api/client';
import {
  SUBSCRIPTION_VIEW_ROLES,
  getCustomerSubscriptionSummary,
  getSubscriptionsDueTomorrow,
} from '@/lib/api/staff-subscriptions';
import { getSubscriptionOptions } from '@/lib/api/subscriptions';
import { getStaffProduct, updateProductDetails } from '@/lib/api/staff-shop';
import { resetShopMockData, shopFixtureIds } from '../../../mocks/handlers/shop';
import { MOCK_VIEW_ROLES } from '../../../mocks/handlers/subscriptions/staff';
import { setMockTouchpointRoles } from '../../../mocks/handlers/subscriptions/touchpoints';
import { subscriptionFixtureIds } from '../../../mocks/handlers/subscriptions/fixtures';
import { db, resetSubscriptionsMockData } from '../../../mocks/handlers/subscriptions/store';

/**
 * U39 (HO-P6 S3, §11.4.6, A18) -- the touch-point mock refuses exactly what the server refuses.
 * T3, T9: StaffSubscriptionsController.cs:53 and :157 (`[RequireAction(Actions.Subscriptions.View)]`, ActionRoles.Subscriptions.cs:12-14).
 * `PUT` details `isSubscribable`: StaffProductRequests.cs:32-33, UpdateProductDetailsCommandHandler.cs:62 (omitted leaves it, a boolean sets it,
 * anything else cannot bind: 400 before the command).
 */
const ids = subscriptionFixtureIds;
const ALL_ROLES = ['Reception', 'Inventory', 'ShopManager', 'Accountant', 'Administrator', 'Cashier', 'Rider'];

beforeEach(() => {
  resetSubscriptionsMockData();
  resetShopMockData();
  setMockTouchpointRoles(null);
});
afterEach(() => {
  setMockTouchpointRoles(null);
  document.cookie = 'pc_session=; path=/; max-age=0';
});

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  return run().then(
    () => null,
    (error: unknown) => error,
  );
}

describe('U39 roles on T3 and T9', () => {
  it('the mock view roles are the web view roles', () => {
    expect([...MOCK_VIEW_ROLES].sort()).toEqual([...SUBSCRIPTION_VIEW_ROLES].sort());
  });

  it.each(ALL_ROLES)('%s: T3 and T9 answer 403 exactly when the role is outside Subscriptions.View', async (role) => {
    setMockTouchpointRoles([role]);
    const allowed = SUBSCRIPTION_VIEW_ROLES.includes(role);
    const due = await failure(() => getSubscriptionsDueTomorrow());
    const summary = await failure(() => getCustomerSubscriptionSummary(ids.customerId));
    if (allowed) {
      expect(due).toBeNull();
      expect(summary).toBeNull();
    } else {
      expect(due).toBeInstanceOf(ApiForbiddenError);
      expect(summary).toBeInstanceOf(ApiForbiddenError);
    }
  });
});

describe('U39 T3 and T9 bodies', () => {
  it('T3 counts the Active subscriptions due tomorrow in the commerce zone, with the live and suspended counts', async () => {
    const due = await getSubscriptionsDueTomorrow();
    expect(due.commerceTimeZoneId).toBe('Asia/Dhaka');
    expect(due.count).toBeGreaterThanOrEqual(1);
    expect(due.count).toBe(db.subscriptions.filter((s) => s.status === 'Active' && s.nextDeliveryOn === due.dueOn).length);
    expect(due.liveCount).toBe(db.subscriptions.filter((s) => s.status !== 'Cancelled').length);
    expect(due.suspendedCount).toBe(db.subscriptions.filter((s) => s.status === 'Suspended').length);
  });

  it('T9 lists every non-cancelled subscription of the customer (Suspended included), soonest delivery first, none last, with the two counts', async () => {
    const summary = await getCustomerSubscriptionSummary(ids.customerId);
    const mine = db.subscriptions.filter((s) => s.customerId === ids.customerId);
    expect(summary.live.map((s) => s.id).sort()).toEqual(mine.filter((s) => s.status !== 'Cancelled').map((s) => s.id).sort());
    expect(summary.live.some((s) => s.status === 'Suspended')).toBe(true);
    expect(summary.live.every((s) => s.status !== 'Cancelled')).toBe(true);
    expect(summary.cancelledCount).toBe(mine.filter((s) => s.status === 'Cancelled').length);
    expect(summary.suspendedCount).toBe(summary.live.filter((s) => s.status === 'Suspended').length);
    const dates = summary.live.map((s) => s.nextDeliveryOn);
    const withDate = dates.filter((d): d is string => d !== null);
    expect(withDate).toEqual([...withDate].sort());
    expect(dates.slice(0, withDate.length).every((d) => d !== null)).toBe(true);
  });

  it('an unknown customer has none: 200 with an empty summary, not a 404', async () => {
    const summary = await getCustomerSubscriptionSummary('c0000000-0000-0000-0000-0000000000f9');
    expect(summary).toEqual({ live: [], cancelledCount: 0, suspendedCount: 0 });
  });

  it('a non-GUID customer id is 404 for every role, even one outside View (the route constraint comes first)', async () => {
    setMockTouchpointRoles(['Cashier']);
    expect(await failure(() => getCustomerSubscriptionSummary('not-a-guid'))).toBeInstanceOf(ApiNotFoundError);
    // A real GUID with the same role is still the 403.
    expect(await failure(() => getCustomerSubscriptionSummary(ids.customerId))).toBeInstanceOf(ApiForbiddenError);
  });

  it('a customer id that is not a GUID matches no route: 404', async () => {
    const error = await failure(() => getCustomerSubscriptionSummary('not-a-guid'));
    expect(error).toBeInstanceOf(ApiNotFoundError);
  });
});

describe('U39 isSubscribable on the details PUT (P1, P2)', () => {
  const baseRequest = async (productId: string) => {
    const p = await getStaffProduct(productId);
    return {
      expectedVersion: p.version,
      name: p.name,
      brand: p.brand,
      description: p.description,
      category: p.category,
      subcategory: p.subcategory,
      tags: p.tags,
      taxClassId: p.taxClassId,
      countryOfOriginCode: p.countryOfOriginCode,
      listedOnStorefront: p.listedOnStorefront,
      isExpiryTracked: p.isExpiryTracked,
      certifications: [],
    };
  };

  it('the staff detail always sends isSubscribable', async () => {
    expect((await getStaffProduct(shopFixtureIds.multiVariantProductId)).isSubscribable).toBe(true);
    expect((await getStaffProduct(shopFixtureIds.kitProductId)).isSubscribable).toBe(false);
  });

  it('omitted leaves the flag unchanged; a boolean sets it', async () => {
    const id = shopFixtureIds.multiVariantProductId;
    await updateProductDetails(id, await baseRequest(id));
    expect((await getStaffProduct(id)).isSubscribable).toBe(true);
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: false });
    expect((await getStaffProduct(id)).isSubscribable).toBe(false);
    await updateProductDetails(id, await baseRequest(id));
    expect((await getStaffProduct(id)).isSubscribable).toBe(false);
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: true });
    expect((await getStaffProduct(id)).isSubscribable).toBe(true);
  });

  it('a value that is not a boolean is a 400 before the command, and changes nothing (even with a stale version)', async () => {
    const id = shopFixtureIds.multiVariantProductId;
    const request = await baseRequest(id);
    for (const bad of ['yes', 1, {}, []]) {
      const error = await failure(() => updateProductDetails(id, { ...request, isSubscribable: bad as never }));
      expect(error).toBeInstanceOf(ApiValidationError);
    }
    const stale = await failure(() =>
      updateProductDetails(id, { ...request, expectedVersion: request.expectedVersion + 5, isSubscribable: 'maybe' as never }),
    );
    expect(stale).toBeInstanceOf(ApiValidationError);
    expect((stale as ApiValidationError).response.errors).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ errorCode: 'ProductVersionConflict' })]),
    );
    expect((await getStaffProduct(id)).isSubscribable).toBe(true);
  });

  it('the 400 for a non-boolean is the real API body (HO-P6 integration part 2, T12)', async () => {
    const id = shopFixtureIds.multiVariantProductId;
    const request = { ...(await baseRequest(id)), isSubscribable: 'yes' as never };
    const error = (await failure(() => updateProductDetails(id, request))) as ApiValidationError;
    const raw = JSON.stringify(request);
    const position = raw.indexOf('"isSubscribable":"yes"') + '"isSubscribable":"yes"'.length;
    expect(error.response.errors).toEqual({
      request: ['The request field is required.'],
      '$.isSubscribable': [
        `The JSON value could not be converted to System.Nullable\`1[System.Boolean]. Path: $.isSubscribable | LineNumber: 0 | BytePositionInLine: ${position}.`,
      ],
    });
  });

  it('a save that changes the flag moves the version by 2; the same value or none by 1 (HO-P6 integration part 2)', async () => {
    const id = shopFixtureIds.multiVariantProductId;
    const v0 = (await getStaffProduct(id)).version;
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: false });
    expect((await getStaffProduct(id)).version).toBe(v0 + 2);
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: false });
    expect((await getStaffProduct(id)).version).toBe(v0 + 3);
    await updateProductDetails(id, await baseRequest(id));
    expect((await getStaffProduct(id)).version).toBe(v0 + 4);
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: true });
    expect((await getStaffProduct(id)).version).toBe(v0 + 6);
  });

  it("C1's subscribable follows the flag immediately", async () => {
    document.cookie = 'pc_session=test; path=/'; // C1 is a customer endpoint
    const id = shopFixtureIds.multiVariantProductId;
    const sku = ids.skus.oats400;
    const before = await getSubscriptionOptions(sku);
    expect(before.subscribable).toBe(true);
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: false });
    const off = await getSubscriptionOptions(sku);
    expect(off.subscribable).toBe(false);
    expect(off.notSubscribableReason).toBeTruthy();
    await updateProductDetails(id, { ...(await baseRequest(id)), isSubscribable: true });
    expect((await getSubscriptionOptions(sku)).subscribable).toBe(true);
  });
});
