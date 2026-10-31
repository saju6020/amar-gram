'use client';

import { useId, useState } from 'react';
import { Panel } from '@/components/back-office/Panel';
import { TableFrame } from '@/components/back-office/TableFrame';
import { AmountCell } from '@/components/billing/Amount';
import { Button } from '@/components/ui/button';
import type { SalesSeries, SalesSeriesDay } from '@/lib/api/dashboard';
import { formatMoney } from '@/lib/format/money';
import { toChartNumber } from '@/lib/format/report';
import { formatDateOnly } from '@/lib/format/time';
import { useSalesSeries } from '@/lib/hooks/useSalesSeries';
import { cn } from '@/lib/utils';

/**
 * `components/dashboard/DashboardSalesChart.tsx` — HO-P5 §11.3.3 (BG-1), US-RPT-05, ADR-FE-188. "Sales, last
 * 14 days": a bar for each day's net sales, oldest first, each bar a focusable button whose name and the
 * polite readout say "{date}: {amount}, {n} orders". The heading figure is the server's `total`; every
 * amount shown is the server's string through `formatMoney`. The only number made from an amount is the
 * bar length (the reports chart's `toChartNumber`, as a share of the tallest day); nothing is summed.
 * "Show as table" swaps the bars for the same days as a table (Date, Net sales, Orders). The panel exists
 * only while the series query succeeded: a `403` (a role without `Reports.SalesView`, or no branch) or a
 * failed read leaves it out, with no error banner, because the rest of the dashboard stands without it.
 */
function ordersText(count: number): string {
  return `${count} order${count === 1 ? '' : 's'}`;
}

function readoutOf(day: SalesSeriesDay): string {
  return `${formatDateOnly(day.date)}: ${formatMoney(day.net)}, ${ordersText(day.orders)}`;
}

/** Each day's bar length as a percentage of the tallest day (geometry only; ADR-FE-188). */
function barShares(days: SalesSeriesDay[]): number[] {
  const values = days.map((day) => Math.max(0, toChartNumber(day.net) ?? 0));
  const peak = Math.max(0, ...values);
  return values.map((value) => (peak > 0 ? Math.round((value / peak) * 100) : 0));
}

export function SalesChartPanel({ series }: { series: SalesSeries }) {
  const [asTable, setAsTable] = useState(false);
  // Focus wins over the pointer: moving the mouse off the bars must not blank the readout of the bar a keyboard user is on.
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = focused ?? hovered;
  const contentId = useId();
  const shares = barShares(series.days);
  const heading = `Sales, last ${series.days.length} days`;
  const activeDay = active === null ? undefined : series.days[active];

  return (
    <Panel
      title={heading}
      actions={
        <Button variant="secondary" size="sm" aria-pressed={asTable} aria-controls={contentId} onClick={() => setAsTable((on) => !on)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4" id={contentId}>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
          <span>Net sales</span>
          <strong className="font-display text-[26px] font-bold text-ink">{formatMoney(series.total)}</strong>
        </p>
        {asTable ? (
          <TableFrame label="Net sales by day" minWidth={320}>
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Net sales and orders for each of the last {series.days.length} days</caption>
              <thead>
                <tr className="border-b border-surface-sunken text-[13px] text-ink-muted">
                  <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Net sales</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Orders</th>
                </tr>
              </thead>
              <tbody>
                {series.days.map((day) => (
                  <tr key={day.date} className="border-b border-surface-sunken last:border-0">
                    <th scope="row" className="whitespace-nowrap px-4 py-2 font-normal">{formatDateOnly(day.date)}</th>
                    <td className="px-4 py-2 text-right tabular-nums"><AmountCell money={day.net} /></td>
                    <td className="px-4 py-2 text-right tabular-nums">{day.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <>
            <ul
              aria-label={`${heading}, net sales for each day`}
              className="m-0 flex h-44 list-none items-stretch gap-1 p-0 sm:gap-1.5"
              onMouseLeave={() => setHovered(null)}
            >
              {series.days.map((day, index) => (
                <li key={day.date} className="flex min-w-0 flex-1 flex-col items-stretch">
                  <button
                    type="button"
                    aria-label={readoutOf(day)}
                    onFocus={() => setFocused(index)}
                    onMouseEnter={() => setHovered(index)}
                    onBlur={() => setFocused(null)}
                    className="group flex min-h-0 flex-1 flex-col justify-end rounded-sm border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      aria-hidden="true"
                      style={{ height: `${shares[index]}%` }}
                      className={cn(
                        'block min-h-0.5 w-full rounded-t-sm transition-colors',
                        active === index ? 'bg-leaf-ink' : 'bg-leaf group-hover:bg-leaf-ink',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
            {/* The first and last day only: fourteen day numbers would not fit a phone; each bar names its own date. */}
            <div aria-hidden="true" className="-mt-2 flex justify-between text-[11px] leading-none text-ink-muted">
              <span>{formatDateOnly(series.days[0]?.date ?? series.from)}</span>
              <span>{formatDateOnly(series.days[series.days.length - 1]?.date ?? series.to)}</span>
            </div>
            <p role="status" aria-live="polite" className="m-0 min-h-5 text-sm font-semibold text-ink">
              {activeDay ? readoutOf(activeDay) : ''}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/** The self-loading panel for `/staff`. Absent (not an error) when the read is refused or fails. */
export function DashboardSalesChart() {
  const series = useSalesSeries();
  if (!series.data) return null;
  return <SalesChartPanel series={series.data} />;
}
