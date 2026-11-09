import { describe, expect, it } from 'vitest';
import { orderTrackerSteps } from '@/lib/orders/tracker';
import { ORDER_STATUSES, type CustomerOrderDetail } from '@/lib/api/my-orders';

type TrackerInput = Parameters<typeof orderTrackerSteps>[0];

function packed(fulfilmentMethod: 'Delivery' | 'Pickup'): TrackerInput {
  return {
    status: 'Packed',
    fulfilmentMethod,
    placedOn: '2026-10-10T04:00:00Z',
    branchTimeZoneId: 'Asia/Dhaka',
    statusHistory: [
      { to: 'Confirmed', changedOn: '2026-10-10T05:00:00Z' },
      { to: 'Packing', changedOn: '2026-10-11T04:00:00Z' },
      { to: 'Packed', changedOn: '2026-10-11T06:00:00Z' },
    ],
    fulfilment: { slotDate: null, slotWindow: null } as CustomerOrderDetail['fulfilment'],
  };
}

describe('HO-P5 U1 - a Packed order keeps its tracker (ADR-FE-189)', () => {
  it.each(['Delivery', 'Pickup'] as const)('%s: five nodes, Packing current, earlier done', (method) => {
    const steps = orderTrackerSteps(packed(method));
    expect(steps).not.toBeNull();
    expect(steps).toHaveLength(5);
    expect(steps!.map((s) => s.status)).toEqual(['done', 'done', 'current', 'future', 'future']);
    expect(steps![2]!.label).toBe('Packing');
  });

  it('the Packing caption is the time the order entered Packing', () => {
    expect(orderTrackerSteps(packed('Delivery'))![2]!.caption).toMatch(/Sun 11 Oct, 10:00/);
  });

  it('ORDER_STATUSES lists Packed between Packing and Dispatched', () => {
    const at = ORDER_STATUSES.indexOf('Packed');
    expect(at).toBeGreaterThan(-1);
    expect(ORDER_STATUSES[at - 1]).toBe('Packing');
    expect(ORDER_STATUSES[at + 1]).toBe('Dispatched');
  });
});
