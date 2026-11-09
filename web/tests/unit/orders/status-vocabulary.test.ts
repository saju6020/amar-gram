import { beforeEach, describe, expect, it } from 'vitest';
import { orderStatusLabel as portalOrderStatusLabel } from '@/components/portal/dashboard/labels';
import { orderActionLabel, orderChannelLabel, orderStatusLabel } from '@/lib/format/orders';
import { db, resetOrderingMockData } from '@/mocks/handlers/ordering/store';
import { orderingIds } from '@/mocks/handlers/ordering/fixtures';
import { seedProducts } from '@/mocks/handlers/shop/fixtures';

describe('HO-P5 U2 - labels', () => {
  it('Packed, MarkPacked and the Subscription channel have labels', () => {
    expect(orderStatusLabel('Packed')).toBe('Packed');
    expect(orderActionLabel('MarkPacked')).toBe('Mark packed');
    expect(orderChannelLabel('Subscription')).toBe('Subscription');
  });

  it('the portal order tile labels Packed instead of "Status unavailable"', () => {
    expect(portalOrderStatusLabel('Packed')).toEqual({ label: 'Packed', tone: 'success' });
  });

  it('every pre-existing label is unchanged', () => {
    expect(
      ['PendingPayment', 'Confirmed', 'Packing', 'Dispatched', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].map(
        orderStatusLabel,
      ),
    ).toEqual([
      'Waiting for payment',
      'Confirmed',
      'Being packed',
      'Dispatched',
      'Delivered',
      'Cancelled',
      'Returned',
      'Refunded',
    ]);
    expect(orderActionLabel('StartPacking')).toBe('Start packing');
    expect(orderActionLabel('RecordDelivery', 'Pickup')).toBe('Record collection');
    expect(orderChannelLabel('Online')).toBe('Online');
    expect(orderChannelLabel('Counter')).toBe('Counter');
  });
});

describe('HO-P5 U4 - the shared mock seeds', () => {
  beforeEach(() => resetOrderingMockData());

  it('ordering store: a Packed order with every line picked', () => {
    const packed = db.orders.find((o) => o.id === 'f0000000-0000-0000-0000-000000000112')!;
    expect(packed.status).toBe('Packed');
    expect(packed.lines.length).toBeGreaterThan(0);
    expect(packed.lines.every((l) => l.picked === true && l.pickedOn && l.pickedBy)).toBe(true);
    expect(packed.packedOn).toBeTruthy();
  });

  it('ordering store: two active riders and one inactive at the main branch', () => {
    const main = db.riders.filter((r) => r.branchId === orderingIds.mainBranchId);
    expect(main.filter((r) => r.isActive)).toHaveLength(2);
    expect(main.filter((r) => !r.isActive)).toHaveLength(1);
  });

  it('ordering store: a dispatched cash-on-delivery order out with a rider (no courier)', () => {
    const out = db.orders.find((o) => o.id === 'f0000000-0000-0000-0000-000000000113')!;
    expect(out.status).toBe('Dispatched');
    expect(out.paymentMethod).toBe('CashOnDelivery');
    expect(out.shipment!.riderId).toBeTruthy();
    expect(out.shipment!.courierId).toBeNull();
    expect(db.riders.some((r) => r.id === out.shipment!.riderId && r.name === out.shipment!.riderName)).toBe(true);
  });

  it('ordering store: a delivered order with a rider note; existing ids, statuses and amounts kept', () => {
    const delivered = db.orders.find((o) => o.id === orderingIds.orders.delivered)!;
    expect(delivered.fulfilment.riderNote).toBeTruthy();
    const expected: Record<string, [status: string, grandTotalCents: number]> = {
      [orderingIds.orders.awaitingTransfer]: ['PendingPayment', 498000],
      [orderingIds.orders.transferReported]: ['PendingPayment', 203000],
      [orderingIds.orders.heldPayment]: ['PendingPayment', 19608000],
      [orderingIds.orders.confirmedCod]: ['Confirmed', 409000],
      [orderingIds.orders.packingPickup]: ['Packing', 130000],
      [orderingIds.orders.dispatchedCod]: ['Dispatched', 498000],
      [orderingIds.orders.delivered]: ['Delivered', 563000],
      [orderingIds.orders.expired]: ['Cancelled', 138000],
      [orderingIds.orders.counterSale]: ['Delivered', 78000],
      [orderingIds.orders.deliveredOpenedFood]: ['Delivered', 86000],
      [orderingIds.orders.cancelledPaid]: ['Cancelled', 73000],
    };
    for (const [id, [status, grandTotalCents]] of Object.entries(expected)) {
      const order = db.orders.find((o) => o.id === id);
      expect(order?.status).toBe(status);
      expect(order?.grandTotalCents).toBe(grandTotalCents);
    }
  });

  it('shop fixtures: districts shared by two products, products without one, two Was prices, one expired and one valid certificate', () => {
    const products = seedProducts();
    const byDistrict = new Map<string, number>();
    for (const p of products) if (p.district) byDistrict.set(p.district, (byDistrict.get(p.district) ?? 0) + 1);
    expect([...byDistrict.values()].some((n) => n >= 2)).toBe(true);
    expect(products.some((p) => !p.district)).toBe(true);
    const foods = products.filter((p) => p.isExpiryTracked);
    expect(foods.filter((p) => p.district).length).toBeGreaterThan(foods.length / 2);
    const wasPrice = (slug: string) => products.find((p) => p.slug === slug)?.skus.find((s) => s.compareAtCents)?.compareAtCents;
    expect(wasPrice('organic-rolled-oats')).toBe(280000);
    expect(wasPrice('date-palm-gur')).toBe(79000);
    const dated = products.filter((p) => p.organicCertificateExpiresOn);
    const today = new Date().toISOString().slice(0, 10);
    expect(dated.filter((p) => p.organicCertificateExpiresOn! < today)).toHaveLength(1);
    const valid = dated.filter((p) => p.organicCertificateExpiresOn! >= today);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.organicCertificateFileId).toBeTruthy();
  });
});
