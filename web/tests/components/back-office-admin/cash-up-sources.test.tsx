import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { resetBillingMockData } from '../../../mocks/handlers/billing';
import { CashUpScreen } from '@/components/billing/CashUpScreen';
import { closeCashUp, getCashUp, recordCashCount } from '@/lib/api/billing-cashup';
import { addDaysIso, todayInZone } from '@/lib/format/time';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

function renderWithClient(ui: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } })) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// The seed gives the day two days ago a staff collector beside the till; today has the till alone.
const TODAY = () => todayInZone('Asia/Dhaka');
const TWO_SOURCES = () => addDaysIso(TODAY(), -2);

beforeEach(() => {
  resetBillingMockData();
  setUrl(`/staff/billing/cash-up?date=${TWO_SOURCES()}`);
});

// HO-P5 §15 U42 (BG-20, US-BIL-12). The expected cash, each source's counted amount and variance, the total and the day's
// variance are all the server's strings, shown as sent: nothing here adds or subtracts.
describe('CashUpScreen per source — U42 (HO-P5 §11.5.5)', () => {
  it('lists the till and the staff collector, each with Expected and one input labelled "Counted for {source}"', async () => {
    renderWithClient(<CashUpScreen />);
    const table = within(await screen.findByRole('region', { name: 'Count cash by source' })).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Source',
      'Expected',
      'Counted',
      'Over or short',
    ]);
    expect(within(table).getByRole('rowheader', { name: 'Till' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Rezwan Ahmed' })).toBeInTheDocument();
    expect(screen.getByLabelText('Counted for Till')).toBeInTheDocument();
    expect(screen.getByLabelText('Counted for Rezwan Ahmed')).toBeInTheDocument();
    // Not counted yet: no invented over/short, and the HO-P4 single input is not there.
    expect(within(table).getAllByText('Not counted yet')).toHaveLength(2);
    expect(screen.queryByLabelText(/^Counted cash/)).not.toBeInTheDocument();
  });

  it('submits counts[] with each amount as a JSON number (wireMoney), and shows the server\'s per-source variance, total and day variance', async () => {
    let body = '';
    server.use(
      http.put('*/api/staff/billing/cash-ups/:date/count', async ({ request }) => {
        body = await request.clone().text();
        // Hand on to the mock server, which does the arithmetic.
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<CashUpScreen />);
    const till = await screen.findByLabelText('Counted for Till');
    await user.type(till, '1');
    await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1200');
    await user.click(screen.getByRole('button', { name: 'Save count' }));

    await waitFor(() => expect(body).not.toBe(''));
    const sent = JSON.parse(body) as { counts: Array<{ sourceKey: string; countedCash: number | string }>; countedCash?: unknown };
    expect(sent.countedCash).toBeUndefined();
    expect(sent.counts.map((c) => c.sourceKey)).toEqual(['till', expect.stringMatching(/^staff:/)]);
    // The digits go out as typed: 1200 as a number, not a quoted string (this needs `JSON.rawJSON`, which Node 24 has).
    expect('rawJSON' in JSON).toBe(true);
    expect(body).toMatch(/"countedCash":1200(\.00)?[,}]/);

    const table = within(screen.getByRole('region', { name: 'Count cash by source' })).getByRole('table');
    // The staff source balances exactly (1,200.00 expected and counted); the till expected nothing that day, so 1.00 is over.
    const staffRow = within(table).getByRole('rowheader', { name: 'Rezwan Ahmed' }).closest('tr')!;
    await waitFor(() => expect(within(staffRow).getByText('Balanced')).toBeInTheDocument());
    const tillRow = within(table).getByRole('rowheader', { name: 'Till' }).closest('tr')!;
    expect(within(tillRow).getByText('Over BDT 1.00')).toBeInTheDocument();
    // The total counted and the day's variance are the server's: 1 + 1200 = 1201.00.
    const status = screen.getByText(/Counted in total:/);
    expect(status).toHaveTextContent('৳1,201.00');
    // The day's variance is the server's: 1,201.00 counted against 1,200.00 expected.
    expect(status).toHaveTextContent('Variance: Over BDT 1.00');
    // The reply is the screen: a re-read agrees with it.
    const read = await getCashUp(TWO_SOURCES());
    expect(read.counted?.amount).toBe('1201.00');
    expect(read.sources?.find((s) => s.key === 'till')?.counted?.amount).toBe('1.00');
  });

  it('writes the reply to this branch\'s cached day only, never another branch\'s same day', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
    const sentinel = { sentinel: 'another branch, the same day' };
    const otherKey = ['billing', 'cash-up', 'another-branch', TWO_SOURCES()];
    client.setQueryData(otherKey, sentinel);
    const user = userEvent.setup();
    renderWithClient(<CashUpScreen />, client);
    await user.type(await screen.findByLabelText('Counted for Till'), '1');
    await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1200');
    await user.click(screen.getByRole('button', { name: 'Save count' }));
    await waitFor(() => expect(screen.getByText(/Counted in total:/)).toHaveTextContent('৳1,201.00'));
    // The other branch's entry still holds what it held (it may be marked stale, but it was not overwritten).
    expect(client.getQueryData(otherKey)).toBe(sentinel);
  });

  it('a closed day reads as a table with no inputs: each source\'s expected, counted and the server\'s over or short', async () => {
    await recordCashCount(TWO_SOURCES(), {
      counts: [
        { sourceKey: 'till', countedCash: '0' },
        { sourceKey: (await getCashUp(TWO_SOURCES())).sources![1]!.key, countedCash: '1100' },
      ],
      explanation: 'The courier kept 100 for fuel.',
    });
    await closeCashUp(TWO_SOURCES(), (await getCashUp(TWO_SOURCES())).version);
    renderWithClient(<CashUpScreen />);
    const region = await screen.findByRole('region', { name: 'Counted cash by source' });
    expect(screen.queryByLabelText(/^Counted for /)).not.toBeInTheDocument();
    const staffRow = within(region).getByRole('rowheader', { name: 'Rezwan Ahmed' }).closest('tr')!;
    expect(staffRow).toHaveTextContent('৳1,200.00');
    expect(staffRow).toHaveTextContent('৳1,100.00');
    expect(within(staffRow).getByText('Short BDT 100.00')).toBeInTheDocument();
    const tillRow = within(region).getByRole('rowheader', { name: 'Till' }).closest('tr')!;
    expect(within(tillRow).getByText('Balanced')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save count' })).not.toBeInTheDocument();
  });

  it('a refusal of one row\'s amount appears under that row\'s input, not as a general message', async () => {
    server.use(
      http.put('*/api/staff/billing/cash-ups/:date/count', () =>
        HttpResponse.json(
          { isValid: false, errors: [{ propertyName: 'Counts[1].CountedCash', errorCode: 'PredicateValidator', errorMessage: 'must not be negative and have at most two decimals.', resourceName: 'Billing' }] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithClient(<CashUpScreen />);
    await user.type(await screen.findByLabelText('Counted for Till'), '1');
    await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1');
    await user.click(screen.getByRole('button', { name: 'Save count' }));
    const input = screen.getByLabelText('Counted for Rezwan Ahmed');
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('must not be negative and have at most two decimals.')).toBeInTheDocument();
    expect(screen.getByLabelText('Counted for Till')).not.toHaveAttribute('aria-invalid');
  });

  it('blocks a missing or malformed amount before any request, naming the source', async () => {
    let called = false;
    server.use(
      http.put('*/api/staff/billing/cash-ups/:date/count', () => {
        called = true;
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<CashUpScreen />);
    await user.type(await screen.findByLabelText('Counted for Till'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save count' }));
    expect(await screen.findAllByText('Enter the cash you counted.')).toHaveLength(1);
    expect(screen.getByText('Enter an amount such as 1500 or 1500.50.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it.each(['UnknownCashUpSource', 'DuplicateCashUpSource'])(
    '%s is shown as "The sources changed while you were counting. Reload and count again."',
    async (code) => {
      server.use(
        http.put('*/api/staff/billing/cash-ups/:date/count', () =>
          HttpResponse.json(
            { isValid: false, errors: [{ propertyName: 'counts', errorCode: code, errorMessage: 'This day has no such source of cash.', resourceName: 'Billing' }] },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderWithClient(<CashUpScreen />);
      await user.type(await screen.findByLabelText('Counted for Till'), '1');
      await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1');
      await user.click(screen.getByRole('button', { name: 'Save count' }));
      expect(await screen.findByText('The sources changed while you were counting. Reload and count again.')).toBeInTheDocument();
      // What was typed is kept.
      expect(screen.getByLabelText('Counted for Till')).toHaveValue('1');
    },
  );

  it('Close day stays disabled until the count is saved, then is offered', async () => {
    const user = userEvent.setup();
    renderWithClient(<CashUpScreen />);
    await user.type(await screen.findByLabelText('Counted for Till'), '1');
    await user.type(screen.getByLabelText('Counted for Rezwan Ahmed'), '1200');
    expect(screen.getByRole('button', { name: 'Close day' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save count' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close day' })).toBeEnabled());
  });

  it('with no sources the HO-P4 single input remains', async () => {
    server.use(
      http.get('*/api/staff/billing/cash-ups/:date', async ({ params }) => {
        const { cashUpFor } = await import('../../../mocks/handlers/billing/store');
        return HttpResponse.json({ ...cashUpFor(params.date as string, 'b0000000-0000-0000-0000-00000000a001'), sources: [] });
      }),
    );
    renderWithClient(<CashUpScreen />);
    expect(await screen.findByLabelText(/Counted cash/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Count cash by source' })).not.toBeInTheDocument();
  });
});
