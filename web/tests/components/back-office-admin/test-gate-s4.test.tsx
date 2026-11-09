import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiFetch, ApiValidationError } from '@/lib/api/client';
import { accountsFixtureIds, resetAccountsMockData } from '../../../mocks/handlers/areas/accounts';
import { recordCashCount } from '@/lib/api/billing-cashup';
import {
  useCancelRosterException,
  useCancelScheduledRosterPattern,
  useCreateRosterException,
  useSetRosterPattern,
} from '@/lib/hooks/useAdminRosters';
import { usePosCustomerLookup } from '@/lib/hooks/usePos';
import { addDaysIso, todayInZone } from '@/lib/format/time';
import { getDb, resetBillingMockData, staffSourceKey } from '../../../mocks/handlers/billing/store';
import { renderWithClient } from '../reports/helpers';

/**
 * HO-P5 S4 TEST gate — cases the slice's own suite did not hold (TC-HO-P5-WIRING-S4 G1-G3).
 * G1: every roster write the page makes refetches the grid's `roster-cells` (CODE_REVIEW run 1 HIGH; run 2 LOW said only
 *     exception cancel was shown).
 * G2: the per-source cash-up mock checks the date before the total's cap, as `RecordCount` does (CODE_REVIEW run 2 LOW).
 * G3: the staff-record controls are hidden for a customer who is not Active (the `&& active` presentation rule).
 * G8: the browse mock's four bare 400s come in the controller's order (two bad inputs at once: the earlier check answers).
 * G7: the POS customer panel keeps the exact `findCustomers` lookup (U37: the Customers screen browses, the POS does not).
 */

const nav = vi.hoisted(() => ({ search: '', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
  usePathname: () => '/staff/customers',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import StaffCustomersPage from '@/app/(staff)/staff/customers/page';

const BRANCH = 'b-gate';
const CELLS_KEY = ['admin', 'branches', BRANCH, 'roster-cells', { from: '2027-01-04', to: '2027-01-10' }];

function hookWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('G1 — every roster write refetches the cells (R1)', () => {
  beforeEach(() => {
    server.use(
      http.put('*/api/admin/branches/:branchId/rosters/:staffAccountId/pattern', () => new HttpResponse(null, { status: 204 })),
      http.delete('*/api/admin/branches/:branchId/rosters/:staffAccountId/next-pattern', () => new HttpResponse(null, { status: 204 })),
      http.post('*/api/admin/branches/:branchId/roster-exceptions', () => HttpResponse.json({ rosterExceptionId: 'ex-1' }, { status: 201 })),
      http.delete('*/api/admin/branches/:branchId/roster-exceptions/:id', () => new HttpResponse(null, { status: 204 })),
    );
  });

  const cases: Array<[string, (client: QueryClient) => Promise<unknown>]> = [
    [
      'saving a weekly pattern',
      async (client) => {
        const { result } = renderHook(() => useSetRosterPattern(BRANCH, 'staff-n'), { wrapper: hookWrapper(client) });
        return result.current.mutateAsync({} as never);
      },
    ],
    [
      'cancelling a scheduled pattern',
      async (client) => {
        const { result } = renderHook(() => useCancelScheduledRosterPattern(BRANCH, 'staff-n'), { wrapper: hookWrapper(client) });
        return result.current.mutateAsync();
      },
    ],
    [
      'adding a roster exception',
      async (client) => {
        const { result } = renderHook(() => useCreateRosterException(BRANCH), { wrapper: hookWrapper(client) });
        return result.current.mutateAsync({
          staffAccountId: 'staff-n',
          date: '2027-01-05',
          kind: 'ExtraShift',
          starts: '08:00',
          ends: '14:00',
          reason: 'Cover',
        });
      },
    ],
    [
      'cancelling a roster exception',
      async (client) => {
        const { result } = renderHook(() => useCancelRosterException(BRANCH), { wrapper: hookWrapper(client) });
        return result.current.mutateAsync('ex-1');
      },
    ],
  ];

  it.each(cases)('%s marks the cached roster-cells week stale', async (_name, run) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CELLS_KEY, []);
    expect(client.getQueryState(CELLS_KEY)?.isInvalidated).toBe(false);
    await run(client);
    expect(client.getQueryState(CELLS_KEY)?.isInvalidated).toBe(true);
  });
});

describe('G2 — the per-source count checks the date before the total cap (R17)', () => {
  beforeEach(() => resetBillingMockData());

  it('a future day whose sources sum over the cap is CashUpDateInFuture on BusinessDate, not InvalidAmount', async () => {
    const tomorrow = addDaysIso(todayInZone('Asia/Dhaka'), 1);
    // A staff collector on that day, so the day has two sources and their sum can pass the cap with each amount within it.
    getDb().staffCash.push({ id: 'gate-cash-1', date: tomorrow, staffAccountId: 'gate-staff', staffName: 'Gate Collector', cents: 100 });
    let failure: unknown;
    try {
      await recordCashCount(tomorrow, {
        counts: [
          { sourceKey: 'till', countedCash: '9999999999.99' },
          { sourceKey: staffSourceKey('gate-staff'), countedCash: '9999999999.99' },
        ],
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ApiValidationError);
    expect((failure as ApiValidationError).response.errors[0]).toMatchObject({
      errorCode: 'CashUpDateInFuture',
      propertyName: 'BusinessDate',
    });
  });
});

describe('G3 — the staff-record controls are for an Active customer only', () => {
  const ADMIN_SESSION = {
    staffAccountId: 'staff-1',
    fullName: 'Rahim Uddin',
    roleIds: ['Administrator'],
    issuedOn: '2026-10-14T00:00:00Z',
    lastActivityOn: '2026-10-14T00:00:00Z',
    idleExpiresOn: '2026-10-14T01:00:00Z',
    absoluteExpiresOn: '2026-10-14T09:00:00Z',
    idleTimeoutMinutes: 30,
    serverTime: '2026-10-14T00:00:00Z',
  };
  const detail = {
    id: 'c1',
    fullName: 'Nusrat Jahan',
    mobileNumber: '01711000001',
    emailAddress: 'nusrat@example.com',
    recordStatus: 'Complete',
    status: 'Active',
    customerSince: '2026-03-14T09:30:00Z',
    area: 'Dhanmondi',
    tags: ['Regular'],
    registrationChannel: 'Reception',
    mergedIntoCustomerId: null as string | null,
    orderCount: 7,
    lifetimeSpend: { amount: '12500.00', currencyCode: 'BDT' },
    noteCount: 0,
  };

  function mockCustomer(status: 'Active' | 'Merged') {
    server.use(
      http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)),
      http.get('*/api/staff/customers/c1', () =>
        HttpResponse.json({ ...detail, status, mergedIntoCustomerId: status === 'Merged' ? 'c9' : null }),
      ),
      http.get('*/api/staff/customers/c1/notes', () => HttpResponse.json([])),
      http.get('*/api/staff/customers/browse', () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    nav.search = 'customer=c1';
  }

  it('control: an Active customer offers Edit tags, Send password reset and Add a note to an Administrator', async () => {
    mockCustomer('Active');
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' });
    expect(await screen.findByRole('button', { name: 'Edit tags' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send password reset' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Notes/ }));
    expect(await screen.findByLabelText('Add a note')).toBeInTheDocument();
  });

  it('a Merged customer shows the tags but no Edit tags, Send password reset or Add a note, even to an Administrator', async () => {
    mockCustomer('Merged');
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' });
    await screen.findByRole('list', { name: 'Tags' });
    expect(screen.queryByRole('button', { name: 'Edit tags' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send password reset' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Notes/ }));
    await screen.findByText('No notes yet');
    expect(screen.queryByLabelText('Add a note')).not.toBeInTheDocument();
  });
});

describe('G7 — the POS lookup is still the exact findCustomers read, not browse (U37g)', () => {
  it('asks GET /api/staff/customers?mobile= with the trimmed number and never calls browse', async () => {
    const seen: string[] = [];
    let browsed = false;
    server.use(
      http.get('*/api/staff/customers', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
      http.get('*/api/staff/customers/browse', () => {
        browsed = true;
        return HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePosCustomerLookup(), { wrapper: hookWrapper(client) });
    await result.current.mutateAsync(' 01711000001 ');
    expect(seen).toEqual(['?mobile=01711000001']);
    expect(browsed).toBe(false);
  });
});

describe('G8 — browse refuses in the controller order when two inputs are bad at once (U47a, M5c)', () => {
  beforeEach(() => resetAccountsMockData());

  async function firstError(query: string): Promise<{ status: number; error: string }> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    const response = await fetch(`${base}/api/staff/customers/browse?${query}`, { credentials: 'include' });
    return { status: response.status, error: ((await response.json()) as { error: string }).error };
  }

  it('pageNumber before pageSize before sort before search/tag', async () => {
    await apiFetch('/api/staff/auth/sign-in', {
      method: 'POST',
      body: { identifier: accountsFixtureIds.stockIdentifier, password: accountsFixtureIds.stockPassword },
    });
    expect(await firstError('pageNumber=1000001&pageSize=101')).toEqual({ status: 400, error: 'pageNumber cannot exceed 1000000.' });
    expect(await firstError('pageSize=101&sort=oldest')).toEqual({ status: 400, error: 'pageSize cannot exceed 100.' });
    expect(await firstError(`sort=oldest&search=${'x'.repeat(101)}`)).toEqual({ status: 400, error: "sort must be 'recent' or 'name'." });
  });
});
