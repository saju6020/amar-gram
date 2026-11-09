import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { DashboardAttention } from '@/components/back-office-overview/DashboardAttention';
import { resetSubscriptionsMockData } from '../../../mocks/handlers/subscriptions/store';
import { setMockTouchpointRoles } from '../../../mocks/handlers/subscriptions/touchpoints';
import { renderWithClient } from '../reports/helpers';

const forbidden = () =>
  HttpResponse.json(
    { isValid: false, errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'no', propertyName: '', resourceName: '' }] },
    { status: 403 },
  );

const noAlerts = () => http.get('*/api/staff/inventory/alerts/summary', () => HttpResponse.json({ open: { total: 0, byKind: {} } }));
const noApprovals = () => http.get('*/api/staff/billing/approvals', () => HttpResponse.json([]));
const dueTomorrow = (count: number, suspendedCount: number) =>
  http.get('*/api/staff/subscriptions/due-tomorrow', () =>
    HttpResponse.json({ dueOn: '2026-11-10', count, liveCount: 9, suspendedCount, commerceTimeZoneId: 'Asia/Dhaka' }),
  );

beforeEach(() => {
  resetSubscriptionsMockData();
  setMockTouchpointRoles(null);
});

/**
 * U37 (HO-P6 S3, §11.4.4, A16, OQ-12) -- the dashboard's two subscription rows from T3, each only above zero, with a
 * `403` dropping both without a banner; the panel is absent only when all three sources are refused.
 */
describe('Dashboard attention -- subscription rows (U37)', () => {
  it('shows "Subscription orders due tomorrow" with the server count, linked to the Active list for the due day', async () => {
    server.use(noAlerts(), noApprovals(), dueTomorrow(4, 0));
    renderWithClient(<DashboardAttention />);
    const row = await screen.findByRole('link', { name: /Subscription orders due tomorrow/ });
    expect(row).toHaveAttribute('href', '/staff/subscriptions?status=Active&nextDeliveryOn=2026-11-10');
    expect(row).toHaveTextContent('4');
    expect(row).toHaveClass('min-h-11');
    expect(screen.queryByRole('link', { name: /Subscriptions suspended/ })).not.toBeInTheDocument();
  });

  it('shows "Subscriptions suspended" with the server count, linked to the Suspended list, after the due row', async () => {
    server.use(noAlerts(), noApprovals(), dueTomorrow(2, 3));
    renderWithClient(<DashboardAttention />);
    const suspended = await screen.findByRole('link', { name: /Subscriptions suspended/ });
    expect(suspended).toHaveAttribute('href', '/staff/subscriptions?status=Suspended');
    expect(suspended).toHaveTextContent('3');
    const links = screen.getAllByRole('link').map((a) => a.textContent ?? '');
    expect(links[0]).toMatch(/Subscription orders due tomorrow/);
    expect(links[1]).toMatch(/Subscriptions suspended/);
  });

  it('the subscription rows come after the existing ones, whose order is unchanged', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', () =>
        HttpResponse.json({ open: { total: 5, byKind: { Expired: 1, ExpiryThreshold: 3, LowStock: 2 } } }),
      ),
      http.get('*/api/staff/billing/approvals', () => HttpResponse.json([{ paymentId: 'p1' }])),
      dueTomorrow(1, 1),
    );
    renderWithClient(<DashboardAttention />);
    await screen.findByRole('link', { name: /Subscriptions suspended/ });
    // The three sources arrive independently, so wait for the full list before reading the order.
    await waitFor(() =>
      expect(screen.getAllByRole('link').map((a) => (a.textContent ?? '').replace(/\d+$/, ''))).toEqual([
        'Batches past their expiry date',
        'Batches nearing expiry',
        'Items below their reorder level',
        'Payments waiting for approval',
        'Subscription orders due tomorrow',
        'Subscriptions suspended',
      ]),
    );
  });

  it('shows neither row at zero, and says nothing needs attention', async () => {
    server.use(noAlerts(), noApprovals(), dueTomorrow(0, 0));
    renderWithClient(<DashboardAttention />);
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Subscription/ })).not.toBeInTheDocument();
  });

  it('a 403 on T3 drops both rows without a banner; the other rows stay', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', () =>
        HttpResponse.json({ open: { total: 2, byKind: { LowStock: 2 } } }),
      ),
      noApprovals(),
      http.get('*/api/staff/subscriptions/due-tomorrow', forbidden),
    );
    renderWithClient(<DashboardAttention />);
    expect(await screen.findByRole('link', { name: /Items below their reorder level/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Subscription/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn.t check/)).not.toBeInTheDocument();
  });

  it('is not absent when only two sources are refused (the third still has rows)', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', forbidden),
      http.get('*/api/staff/billing/approvals', forbidden),
      dueTomorrow(5, 0),
    );
    renderWithClient(<DashboardAttention />);
    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Subscription orders due tomorrow/ })).toBeInTheDocument();
  });

  it('is absent when all three sources are refused', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', forbidden),
      http.get('*/api/staff/billing/approvals', forbidden),
      http.get('*/api/staff/subscriptions/due-tomorrow', forbidden),
    );
    renderWithClient(<DashboardAttention />);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument());
  });

  it('shows "Checking…" while the reads are pending, then the failure line if the subscription read fails', async () => {
    server.use(
      noAlerts(),
      noApprovals(),
      http.get('*/api/staff/subscriptions/due-tomorrow', () => new HttpResponse(null, { status: 500 })),
    );
    renderWithClient(<DashboardAttention />);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(await screen.findByText(/couldn.t check everything/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('works against the subscriptions mock: the seeded due-tomorrow and suspended counts appear', async () => {
    server.use(noAlerts(), noApprovals());
    renderWithClient(<DashboardAttention />);
    expect(await screen.findByRole('link', { name: /Subscription orders due tomorrow/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Subscriptions suspended/ })).toBeInTheDocument();
  });
});
