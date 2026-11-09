import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { placeRowLabel, placeRowValue } from '@/lib/subscriptions/copy';
import type { SubscriptionTerms } from '@/lib/api/subscriptions';

/** Owner fixes 2026-11-09 (HO-P6 Amended (t)-(z)): jsdom has no layout, so the classes that carry the sizes are asserted. */
const items = [
  { key: 'a', label: 'Orders' },
  { key: 'b', label: 'Billing' },
];

describe('UnderlineTabs wrap', () => {
  it('wraps onto more rows, with no inner scroll, only when asked', () => {
    const { rerender } = render(<UnderlineTabs mode="state" label="Tabs" items={items} value="a" wrap />);
    const wrapped = screen.getByRole('tablist', { name: 'Tabs' });
    expect(wrapped).toHaveClass('flex-wrap');
    expect(wrapped).not.toHaveClass('overflow-x-auto');
    rerender(<UnderlineTabs mode="state" label="Tabs" items={items} value="a" />);
    expect(screen.getByRole('tablist', { name: 'Tabs' })).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('tablist', { name: 'Tabs' })).not.toHaveClass('flex-wrap');
  });
});

describe('dialog close control', () => {
  it('is a 44 px target', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('size-11');
  });
});

describe('terms place row', () => {
  const base = { deliveryAddress: { label: 'Home', line1: 'House 7', city: 'Dhaka' }, pickupBranch: null } as unknown as SubscriptionTerms;
  it('reads once: a label for the way, a value for the place', () => {
    expect(placeRowLabel({ fulfilment: 'Delivery' })).toBe('Deliver to');
    expect(placeRowValue({ ...base, fulfilment: 'Delivery' })).toBe('Home: House 7, Dhaka');
    expect(placeRowLabel({ fulfilment: 'Pickup' })).toBe('Collect from');
    expect(placeRowValue({ ...base, fulfilment: 'Pickup', pickupBranch: { id: 'b', name: 'Dhanmondi outlet' } } as SubscriptionTerms)).toBe('Dhanmondi outlet');
  });
});
