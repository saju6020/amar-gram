'use client';

import { AlertTriangle, Banknote, Clock, PackageMinus } from 'lucide-react';
import { AttentionRow } from '@/components/back-office/AttentionRow';
import { Panel } from '@/components/back-office/Panel';
import { ApiForbiddenError } from '@/lib/api/client';
import type { AlertKind } from '@/lib/api/inventory-alerts';
import { useApprovals } from '@/lib/hooks/billing/useBillingQueries';
import { useAlertSummary } from '@/lib/hooks/useInventory';

const ICON_SIZE = 16;

/** The alert kinds the dashboard shows, one row each: the server's own per-kind counts, never summed here. */
const ALERT_ROWS: Array<{ kind: AlertKind; text: string; tone: 'warning' | 'danger' }> = [
  { kind: 'Expired', text: 'Batches past their expiry date', tone: 'danger' },
  { kind: 'ExpiryThreshold', text: 'Batches nearing expiry', tone: 'warning' },
  { kind: 'LowStock', text: 'Items below their reorder level', tone: 'warning' },
];

/**
 * `components/back-office-overview/DashboardAttention.tsx` — HO-P4 §11.2.3, US-RPT-05, US-IMP-10/12.
 * The "Needs attention" panel. Each row comes from a query of its own and is rendered only when that
 * query succeeded with something to show; a `403` (a role without that area) drops the row without
 * a banner. If neither area is open to the caller, the panel is absent altogether.
 */
export function DashboardAttention() {
  const alerts = useAlertSummary();
  const approvals = useApprovals();

  const alertsRefused = alerts.error instanceof ApiForbiddenError;
  const approvalsRefused = approvals.error instanceof ApiForbiddenError;
  if (alertsRefused && approvalsRefused) return null;

  const pending = alerts.isPending || approvals.isPending;
  const byKind = alerts.data?.open.byKind ?? {};
  const alertRows = ALERT_ROWS.filter((row) => (byKind[row.kind] ?? 0) > 0);
  const approvalCount = approvals.data?.length ?? 0;
  const failed = (alerts.isError && !alertsRefused) || (approvals.isError && !approvalsRefused);
  const hasRows = alertRows.length > 0 || approvalCount > 0;

  return (
    <Panel title="Needs attention">
      <div className="flex flex-col gap-2">
        {alertRows.map((row) => (
          <AttentionRow
            key={row.kind}
            tone={row.tone}
            icon={
              row.kind === 'LowStock' ? (
                <PackageMinus size={ICON_SIZE} />
              ) : row.kind === 'Expired' ? (
                <AlertTriangle size={ICON_SIZE} />
              ) : (
                <Clock size={ICON_SIZE} />
              )
            }
            text={row.text}
            count={byKind[row.kind]}
            href="/staff/inventory/alerts"
          />
        ))}
        {approvalCount > 0 && (
          <AttentionRow
            tone="warning"
            icon={<Banknote size={ICON_SIZE} />}
            text="Payments waiting for approval"
            count={approvalCount}
            href="/staff/billing/approvals"
          />
        )}
        {pending && !hasRows && (
          <p role="status" className="text-sm text-ink-muted">
            Checking…
          </p>
        )}
        {!pending && !hasRows && !failed && (
          <p className="text-sm text-ink-muted">Nothing needs attention right now.</p>
        )}
        {!pending && !hasRows && failed && (
          <p role="status" className="text-sm text-ink-muted">
            We couldn&rsquo;t check everything just now. This panel refreshes on its own.
          </p>
        )}
      </div>
    </Panel>
  );
}
