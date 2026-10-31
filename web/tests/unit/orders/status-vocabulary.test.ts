import { beforeEach, describe, expect, it } from 'vitest';
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
    const packed = db.orders.filter((o) => o.status === 'Packed');
    expect(packed).toHaveLength(1);
    expect(packed[0]!.lines.length).toBeGreaterThan(0);
    expect(packed[0]!.lines.every((l) => l.picked === true && l.pickedOn && l.pickedBy)).toBe(true);
    expect(packed[0]!.packedOn).toBeTruthy();
  });

  it('ordering store: two active riders and one inactive at the main branch', () => {
    const main = db.riders.filter((r) => r.branchId === orderingIds.mainBranchId);
    expect(main.filter((r) => r.isActive)).toHaveLength(2);
    expect(main.filter((r) => !r.isActive)).toHaveLength(1);
  });

  it('ordering store: a dispatched cash-on-delivery order out with a rider (no courier)', () => {
    const out = db.orders.filter(
      (o) => o.status === 'Dispatched' && o.paymentMethod === 'CashOnDelivery' && o.shipment?.riderId,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.shipment!.courierId).toBeNull();
    expect(db.riders.some((r) => r.id === out[0]!.shipment!.riderId && r.name === out[0]!.shipment!.riderName)).toBe(true);
  });

  it('ordering store: a delivered order with a rider note; existing ids, statuses and amounts kept', () => {
    expect(db.orders.filter((o) => o.fulfilment.riderNote)).toHaveLength(1);
    const delivered = db.orders.find((o) => o.id === orderingIds.orders.delivered)!;
    expect(delivered.status).toBe('Delivered');
    expect(delivered.fulfilment.riderNote).toBeTruthy();
    const expected: Record<string, string> = {
      [orderingIds.orders.awaitingTransfer]: 'PendingPayment',
      [orderingIds.orders.confirmedCod]: 'Confirmed',
      [orderingIds.orders.packingPickup]: 'Packing',
      [orderingIds.orders.dispatchedCod]: 'Dispatched',
      [orderingIds.orders.counterSale]: 'Delivered',
      [orderingIds.orders.cancelledPaid]: 'Cancelled',
    };
    for (const [id, status] of Object.entries(expected)) {
      expect(db.orders.find((o) => o.id === id)?.status).toBe(status);
    }
    expect(db.orders).toHaveLength(13);
  });

  it('shop fixtures: districts shared by two products, products without one, two Was prices, one expired and one valid certificate', () => {
    const products = seedProducts();
    const byDistrict = new Map<string, number>();
    for (const p of products) if (p.district) byDistrict.set(p.district, (byDistrict.get(p.district) ?? 0) + 1);
    expect([...byDistrict.values()].some((n) => n >= 2)).toBe(true);
    expect(products.some((p) => !p.district)).toBe(true);
    const skus = products.flatMap((p) => p.skus);
    expect(skus.filter((s) => s.compareAtCents)).toHaveLength(2);
    const dated = products.filter((p) => p.organicCertificateExpiresOn);
    const today = new Date().toISOString().slice(0, 10);
    expect(dated.filter((p) => p.organicCertificateExpiresOn! < today)).toHaveLength(1);
    const valid = dated.filter((p) => p.organicCertificateExpiresOn! >= today);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.organicCertificateFileId).toBeTruthy();
  });
});
