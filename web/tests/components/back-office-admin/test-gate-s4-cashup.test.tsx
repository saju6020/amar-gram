import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../mocks/server';
import { resetBillingMockData } from '../../../mocks/handlers/billing';
import { CashUpScreen } from '@/components/billing/CashUpScreen';
import { addDaysIso, todayInZone } from '@/lib/format/time';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P5 S4 TEST gate (TC-HO-P5-WIRING-S4 G9, mutation M2b). §11.5.5: "the response (the full read) replaces the screen".
 * The count's reply must be written into the active branch's exact cache entry, ['billing','cash-up',branchId,date], so the
 * screen shows it without waiting for the refetch. Here every cash-up read after the save is held, so only the reply itself
 * can put the server's total on the screen.
 */
const TWO_SOURCES = () => addDaysIso(todayInZone('Asia/Dhaka'), -2);

beforeEach(() => {
  resetBillingMockData();
  setUrl(`/staff/billing/cash-up?date=${TWO_SOURCES()}`);
});

describe('G9 — the count reply replaces the screen through the exact cache key', () => {
  it('shows the server total from the PUT reply while every later read is held', async () => {
    let saved = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put('*/api/staff/billing/cash-ups/:date/count', () => {
        saved = true;
        return undefined; // fall through to the billing mock, which answers with the full read
      }),
      http.get('*/api/staff/billing/cash-ups/:date', async () => {
        if (saved) await held;
        return undefined;
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <CashUpScreen />
      </QueryClientProvider>,
    );
    await user.type(await screen.findByLabelText('Counted for Till'), '1');
    await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1200');
    await user.click(screen.getByRole('button', { name: 'Save count' }));
    try {
      await waitFor(() => expect(screen.getByText(/Counted in total:/)).toHaveTextContent('৳1,201.00'), { timeout: 3000 });
    } finally {
      release();
    }
  });
});
