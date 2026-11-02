import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { DashboardSalesChart, SalesChartPanel } from '@/components/dashboard/DashboardSalesChart';
import type { SalesSeries } from '@/lib/api/dashboard';
import { renderWithClient } from '../reports/helpers';

/**
 * HO-P5 U16 (§15): the 14-day sales chart. Fourteen focusable bars, a readout in the form "{date}: {money}, {n} orders",
 * the heading figure is the SERVER's `total` string (nothing is summed), "Show as table" gives the same fourteen days as a
 * table, and a refused or failed read leaves the panel out with no error banner.
 */
const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

function dayOf(index: number) {
  const date = `2026-10-${String(index + 1).padStart(2, '0')}`;
  // One day with nothing invoiced; the others differ so the bars differ.
  return { date, net: money(index === 3 ? '0.00' : `${(index + 1) * 1000}.50`), orders: index === 3 ? 0 : index + 1 };
}

const SERIES: SalesSeries = {
  branchId: 'b1',
  branchName: 'Main outlet',
  from: '2026-10-01',
  to: '2026-10-14',
  timeZoneId: 'Asia/Dhaka',
  currencyCode: 'BDT',
  // Deliberately NOT the sum of the days: whatever the server sends is what is shown.
  total: money('123456.78'),
  generatedOn: '2026-10-14T03:42:00+00:00',
  days: Array.from({ length: 14 }, (_, index) => dayOf(index)),
};

describe('SalesChartPanel - U16', () => {
  it('draws fourteen focusable bars named "{date}: {money}, {n} orders", with the server total as the heading figure', async () => {
    renderWithClient(<SalesChartPanel series={SERIES} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Sales, last 14 days' })).toBeInTheDocument();
    expect(screen.getByText('৳123,456.78')).toBeInTheDocument();
    const bars = within(screen.getByRole('list', { name: /net sales for each day/ })).getAllByRole('button');
    expect(bars).toHaveLength(14);
    expect(bars[0]).toHaveAccessibleName('1 Oct 2026: ৳1,000.50, 1 order');
    expect(bars[3]).toHaveAccessibleName('4 Oct 2026: ৳0.00, 0 orders');
    expect(bars[13]).toHaveAccessibleName('14 Oct 2026: ৳14,000.50, 14 orders');
  });

  it('reads a day out in a polite live region when its bar takes focus', async () => {
    renderWithClient(<SalesChartPanel series={SERIES} />);
    const readout = screen.getAllByRole('status').find((node) => node.getAttribute('aria-live') === 'polite')!;
    expect(readout).toHaveTextContent('');
    const bars = within(screen.getByRole('list', { name: /net sales for each day/ })).getAllByRole('button');
    bars[6]!.focus();
    await waitFor(() => expect(readout).toHaveTextContent('7 Oct 2026: ৳7,000.50, 7 orders'));
    bars[6]!.blur();
    await waitFor(() => expect(readout).toHaveTextContent(''));
  });

  it('"Show as table" gives the same days as a table, with the server’s amounts, and goes back', async () => {
    const user = userEvent.setup();
    renderWithClient(<SalesChartPanel series={SERIES} />);
    const toggle = screen.getByRole('button', { name: 'Show as table' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Date', 'Net sales', 'Orders']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toHaveTextContent('1 Oct 2026');
    expect(rows[0]).toHaveTextContent('1,000.50');
    expect(rows[13]).toHaveTextContent('14,000.50');
    expect(screen.queryByRole('list', { name: /net sales for each day/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show as chart' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Oct 2026: / })).toHaveLength(14);
  });

  it('a day with nothing invoiced still has a bar (a zero-length one), and the longest day is full height', async () => {
    renderWithClient(<SalesChartPanel series={SERIES} />);
    const bars = within(screen.getByRole('list', { name: /net sales for each day/ })).getAllByRole('button');
    const heightOf = (button: HTMLElement) => (button.querySelector('span') as HTMLElement).style.height;
    expect(heightOf(bars[13]!)).toBe('100%');
    expect(heightOf(bars[3]!)).toBe('0%');
  });
});

describe('SalesChartPanel - edge cases', () => {
  it('a day with negative net sales (credit notes) gets a zero-length bar, not a negative height', () => {
    const series = { ...SERIES, days: SERIES.days.map((d, i) => (i === 5 ? { ...d, net: money('-250.00') } : d)) };
    renderWithClient(<SalesChartPanel series={series} />);
    const bars = within(screen.getByRole('list', { name: /net sales for each day/ })).getAllByRole('button');
    expect((bars[5]!.querySelector('span') as HTMLElement).style.height).toBe('0%');
    expect(bars[5]).toHaveAccessibleName('6 Oct 2026: -৳250.00, 6 orders');
  });

  it('moving the pointer off the bars does not blank the readout of the bar that has keyboard focus', async () => {
    const user = userEvent.setup();
    renderWithClient(<SalesChartPanel series={SERIES} />);
    const list = screen.getByRole('list', { name: /net sales for each day/ });
    const bars = within(list).getAllByRole('button');
    const readout = screen.getAllByRole('status').find((node) => node.getAttribute('aria-live') === 'polite')!;
    bars[2]!.focus();
    await waitFor(() => expect(readout).toHaveTextContent('3 Oct 2026'));
    await user.hover(bars[8]!);
    await waitFor(() => expect(readout).toHaveTextContent('3 Oct 2026'));
    await user.unhover(bars[8]!);
    await user.unhover(list);
    expect(readout).toHaveTextContent('3 Oct 2026');
    bars[2]!.blur();
    await waitFor(() => expect(readout).toHaveTextContent(''));
  });
});

describe('DashboardSalesChart - U16', () => {
  it('shows the panel once the series has loaded', async () => {
    renderWithClient(<DashboardSalesChart />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Sales, last 14 days' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Oct 2026: / })).toHaveLength(14);
  });

  it('is absent, with no error banner, when the server refuses (403)', async () => {
    let asked = 0;
    server.use(
      http.get('*/api/staff/dashboard/sales-series', () => {
        asked += 1;
        return HttpResponse.json({ errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'no' }] }, { status: 403 });
      }),
    );
    renderWithClient(<DashboardSalesChart />);
    await waitFor(() => expect(asked).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('heading', { name: /Sales, last/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is absent, with no error banner, when the read fails', async () => {
    server.use(http.get('*/api/staff/dashboard/sales-series', () => new HttpResponse(null, { status: 500 })));
    renderWithClient(<DashboardSalesChart />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('heading', { name: /Sales, last/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
