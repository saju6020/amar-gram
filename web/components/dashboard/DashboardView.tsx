import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import type { Dashboard } from '@/lib/api/dashboard';
import { formatReportDate } from '@/lib/format/report';
import { timeOnlyInZone } from '@/lib/format/time';
import { DashboardTile } from './DashboardTile';
import { RefreshAnnouncer } from './RefreshAnnouncer';

/**
 * `components/dashboard/DashboardView.tsx` — ⭐ HO-RPT-002 §11.2, HO-P4 §11.2.2, US-RPT-05. Header
 * ("Today — date · branch", the zone, "Updated HH:mm") and the tiles the server sent, IN THE
 * SERVER'S ORDER. Nothing is added, reordered or filled in: a tile the caller may not see is not in
 * the payload and has no placeholder (ADR-FE-137). The date is the payload's `localDate` (the
 * branch's day), never the browser's today (U-A7).
 *
 * `h1` keeps the pinned "Today — {date} · {branch}" text (OQ-3); the greeting is the eyebrow. The two
 * header actions are shortcuts (presentation only: the server decides who may use them). `panels`
 * is the page's slot for the "Needs attention" and "Latest orders" panels, which load themselves.
 */
export function DashboardView({
  dashboard,
  updatedAt,
  refreshFailed = false,
  greetingName = null,
  panels,
}: {
  dashboard: Dashboard;
  updatedAt: number;
  /** The last background refresh failed; the tiles below are from the last good one. */
  refreshFailed?: boolean;
  /** The signed-in person's first name for the eyebrow; dropped when there is none. */
  greetingName?: string | null;
  panels?: ReactNode;
}) {
  const { timeZoneId } = dashboard;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={greetingName ? `Good morning, ${greetingName}` : 'Good morning'}
        title={`Today — ${formatReportDate(dashboard.localDate)} · ${dashboard.branchName}`}
        description={`Times are in ${timeZoneId}.`}
        actions={
          <>
            <ActionLink href="/staff/pos" variant="outline">
              New counter sale
            </ActionLink>
            <ActionLink href="/staff/inventory/receipts/new" variant="primary">
              Receive goods
            </ActionLink>
          </>
        }
      />
      <p className="-mt-2 inline-flex items-center gap-1.5 text-sm text-ink-muted">
        <RefreshCw size={14} aria-hidden="true" />
        Updated {timeOnlyInZone(dashboard.generatedOn, timeZoneId)} ({timeZoneId})
      </p>

      <RefreshAnnouncer updatedAt={updatedAt} />
      {refreshFailed && (
        <p role="status" className="text-sm text-warning-ink">
          We couldn&rsquo;t refresh just now. These figures are from the last update; we&rsquo;ll
          try again.
        </p>
      )}

      {dashboard.tiles.length === 0 ? (
        <EmptyState
          title="Nothing to show for today yet"
          description={`Today's figures appear here once the areas your role works in are in use at ${dashboard.branchName}. Nothing has been recorded for ${formatReportDate(dashboard.localDate)} (${timeZoneId}) so far.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.tiles.map((tile) => (
            <DashboardTile key={tile.key} tile={tile} timeZoneId={timeZoneId} />
          ))}
        </div>
      )}

      {panels}
    </div>
  );
}
