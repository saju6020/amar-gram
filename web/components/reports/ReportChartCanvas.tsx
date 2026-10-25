'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartPoint {
  label: string;
  value: number | null;
  /** The server's own text for the value (`formatCell`), used in the tooltip. */
  text: string;
}

/** Pixels per bar in the horizontal chart, and the floor, so a short list still reads as a chart. */
const BAR_ROW_PX = 28;
const MIN_CHART_PX = 256;

/**
 * `components/reports/ReportChartCanvas.tsx` — HO-RPT-002 §11.3, ADR-FE-134, HO-P4 §11.2.7. The
 * `recharts` surface only; loaded lazily by `ReportChart` so the page is fast with the chart closed.
 * Decorative to assistive tech (`aria-hidden`, `accessibilityLayer={false}`): the visually hidden
 * data table and the polite readout in `ReportChart` are the accessible representation of the same
 * points (`onActivePoint` feeds that readout). Horizontal bars for counts and money, a line for
 * percentages (OQ-3). Colours are the theme's CSS variables, never literals.
 */
export default function ReportChartCanvas({
  points,
  kind,
  axisLabel,
  seriesLabel,
  formatTick,
  onActivePoint,
}: {
  points: ChartPoint[];
  kind: 'bar' | 'line';
  axisLabel: string;
  seriesLabel: string;
  /** Formats a value-axis tick as a compact label with the currency sign (`formatAxisTick`). */
  formatTick: (value: number) => string;
  /** The index of the point under the pointer, or `null` when it leaves the chart. */
  onActivePoint?: (index: number | null) => void;
}) {
  const margin = { top: 8, right: 16, bottom: 8, left: 16 };
  const tooltip = (
    <Tooltip
      formatter={(_value, _name, item) => [(item.payload as ChartPoint).text, seriesLabel]}
    />
  );
  const track = {
    onMouseMove: (state: { activeTooltipIndex?: unknown }) =>
      onActivePoint?.(typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null),
    onMouseLeave: () => onActivePoint?.(null),
  };

  if (kind === 'line') {
    return (
      <div aria-hidden="true" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={margin} accessibilityLayer={false} {...track}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
            <YAxis
              width={84}
              tick={{ fontSize: 11 }}
              stroke="var(--ink-muted)"
              tickFormatter={(value: number) => formatTick(value)}
              label={{ value: axisLabel, position: 'insideLeft', angle: -90, fontSize: 11, dx: -12 }}
            />
            {tooltip}
            <Line type="monotone" dataKey="value" stroke="var(--leaf)" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full"
      style={{ height: Math.max(MIN_CHART_PX, points.length * BAR_ROW_PX) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          layout="vertical"
          margin={margin}
          accessibilityLayer={false}
          {...track}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="var(--ink-muted)"
            tickFormatter={(value: number) => formatTick(value)}
            label={{ value: axisLabel, position: 'insideBottom', fontSize: 11, offset: -4 }}
            height={40}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            interval={0}
            tick={{ fontSize: 11 }}
            stroke="var(--ink-muted)"
          />
          {tooltip}
          <Bar dataKey="value" fill="var(--leaf)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
