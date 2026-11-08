import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../mocks/server';
import { db, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { StaffOrderQueue } from '@/components/orders/StaffOrderQueue';
import { currentUrl, setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

function renderQueue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <StaffOrderQueue />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/orders');
});

/**
 * U38 (HO-P6 S3, §11.4.5, OQ-11, A16) -- the orders Channel filter offers Subscription; choosing it writes
 * `channel=Subscription` to the URL and asks both the list and the status counts with it.
 */
describe('Orders -- Subscription channel (U38)', () => {
  it('offers Any channel, Online, Counter and Subscription', async () => {
    renderQueue();
    const select = await screen.findByLabelText('Channel');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any channel',
      'Online',
      'Counter',
      'Subscription',
    ]);
    expect(select).toHaveValue('');
  });

  it('choosing Subscription writes channel=Subscription and requests the list and the status counts with it', async () => {
    const user = userEvent.setup();
    const seen: Array<{ path: string; channel: string | null }> = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/api/staff/orders') || url.pathname.endsWith('/api/staff/orders/status-counts')) {
        seen.push({ path: url.pathname, channel: url.searchParams.get('channel') });
      }
    });
    renderQueue();
    await user.selectOptions(await screen.findByLabelText('Channel'), 'Subscription');
    await waitFor(() => expect(currentUrl()).toContain('channel=Subscription'));
    await waitFor(() => {
      expect(seen.some((r) => r.path.endsWith('/api/staff/orders') && r.channel === 'Subscription')).toBe(true);
      expect(seen.some((r) => r.path.endsWith('/status-counts') && r.channel === 'Subscription')).toBe(true);
    });
    server.events.removeAllListeners();
  });

  it('lists only subscription orders, and the pills count them (the mock filters as the server does)', async () => {
    setUrl('/staff/orders?channel=Subscription');
    renderQueue();
    const subscription = db.orders.filter((o) => o.channel === 'Subscription');
    expect(subscription.length).toBeGreaterThan(0);
    const tabs = await screen.findByRole('tablist', { name: 'Order status' });
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: /^All/ })).toHaveTextContent(`All${subscription.length}`));
    for (const order of subscription) {
      expect(await screen.findByRole('button', { name: order.orderNumber })).toBeInTheDocument();
    }
    const others = db.orders.find((o) => o.channel !== 'Subscription')!;
    expect(screen.queryByRole('button', { name: others.orderNumber })).not.toBeInTheDocument();
    // Each listed row names its channel (the existing label case).
    for (const order of subscription) {
      const row = screen.getByRole('button', { name: order.orderNumber }).closest('tr') as HTMLElement;
      expect(row).toHaveTextContent('Subscription');
    }
  });
});
