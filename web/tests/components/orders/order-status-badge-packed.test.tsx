import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { newestOpenOrder } from '@/components/portal/dashboard/LiveOrderCard';
import type { PortalOrderItem } from '@/lib/api/portal';

function iconOf(status: string): string {
  const { container, unmount } = render(<OrderStatusBadge status={status} />);
  const svg = container.querySelector('svg')?.getAttribute('class') ?? '';
  unmount();
  return svg;
}

describe('HO-P5 BG-4 - Packed in the shared order components', () => {
  it('the badge reads "Packed" with its own icon, not the unknown-status fallback', () => {
    render(<OrderStatusBadge status="Packed" />);
    expect(screen.getByText('Packed')).toBeInTheDocument();
    const packed = iconOf('Packed');
    expect(packed).toContain('lucide-box');
    expect(packed).not.toBe(iconOf('SomethingUnknown'));
    expect(packed).not.toBe(iconOf('Packing'));
  });

  it('the portal live order card treats a Packed order as open', () => {
    const items = [
      { id: 'a', status: 'Delivered', placedOn: '2026-10-20T00:00:00Z' },
      { id: 'b', status: 'Packed', placedOn: '2026-10-10T00:00:00Z' },
    ] as unknown as PortalOrderItem[];
    expect(newestOpenOrder(items)?.status).toBe('Packed');
  });
});
