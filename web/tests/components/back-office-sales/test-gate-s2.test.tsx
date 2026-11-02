import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { DashboardSalesChart } from '@/components/dashboard/DashboardSalesChart';
import { ApiError } from '@/lib/api/client';
import { listStaffOrders } from '@/lib/api/staff-orders';
import { ACTIVE_BRANCH_KEY } from '@/lib/hooks/useActiveBranch';
import { resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { renderWithClient } from '../reports/helpers';
import { PosScreen } from '@/components/pos/PosScreen';
import { orderingIds as ids } from '../../../mocks/handlers/ordering/fixtures';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P5 S2 TEST gate (written by the test engineer, TC-HO-P5-WIRING-S2 rows U47i and R3). Two gaps the gate found in the slice's own tests:
 * the mock's `GET …/orders` 400s (the slice report lists them as added; only `status-counts` had a case), and the sales series being
 * keyed by the active branch (Amended (aa); no test switched the branch).
 */
beforeEach(() => resetOrderingMockData());

describe('U47i - GET …/orders refuses what status-counts refuses (StaffOrdersController.cs:123-127)', () => {
  it.each([
    ['fulfilment', { fulfilment: 'Teleport' }],
    ['paymentMethod', { paymentMethod: 'Barter' }],
    ['channel', { channel: 'Telepathy' }],
    ['search over 100 characters', { search: 'x'.repeat(101) }],
  ])('a malformed %s is a 400', async (_name, filters) => {
    const error = await listStaffOrders(filters as never).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
  });

  it('a well-formed filter still lists, and a channel name matches whatever its case', async () => {
    const page = await listStaffOrders({ fulfilment: 'Delivery' } as never);
    expect(page.items.length).toBeGreaterThan(0);
    await expect(listStaffOrders({ channel: 'subscription' } as never)).resolves.toMatchObject({ totalCount: 0 });
  });
});

describe('R3 - the sales series follows the active branch (Amended (aa))', () => {
  it('switching the active branch asks for the series again (only the request is counted, as the header comes from the app client)', async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b0000000-0000-0000-0000-00000000a001', 'b0000000-0000-0000-0000-00000000a002'],
          primaryBranchId: 'b0000000-0000-0000-0000-00000000a001',
          activeBranchId: 'b0000000-0000-0000-0000-00000000a001',
          activeBranchRefusal: null,
        }),
      ),
    );
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.endsWith('/api/staff/dashboard/sales-series')) seen.push(request.headers.get('x-branch-id'));
    });
    try {
      const { client } = renderWithClient(<DashboardSalesChart />);
      expect(await screen.findByRole('heading', { level: 2, name: 'Sales, last 14 days' })).toBeInTheDocument();
      const before = seen.length;
      expect(before).toBeGreaterThan(0);
      client.setQueryData(ACTIVE_BRANCH_KEY, 'b0000000-0000-0000-0000-00000000a002');
      await waitFor(() => expect(seen.length).toBeGreaterThan(before));
    } finally {
      server.events.removeAllListeners();
    }
  });
});

describe('G2 - a buyer typed before the preset lookup answers is not overwritten (the empty-ticket guard in PosScreen)', () => {
  it('keeps what the cashier typed when the held lookup then answers', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get('*/api/staff/customers/:customerId', async () => {
        await gate;
        return HttpResponse.json({ id: ids.customerId, fullName: ids.customerName, mobile: '', mobileNumber: '01711000999', emailAddress: null, recordStatus: 'Complete', registrationChannel: 'Web', status: 'Active', mergedIntoCustomerId: null });
      }),
    );
    setUrl(`/staff/pos?customerId=${ids.customerId}`);
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PosScreen />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Walk-in \(no customer\)/ }));
    await user.type(screen.getByLabelText(/Customer name/), 'Typed Buyer');
    await user.type(screen.getByLabelText(/Mobile number/), '01711222333');
    release();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByLabelText(/Customer name/)).toHaveValue('Typed Buyer');
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue('01711222333');
  });
});
