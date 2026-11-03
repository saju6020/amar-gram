'use client';

import { AlertTriangle, Clock, ShieldAlert, Truck } from 'lucide-react';
import { AttentionRow } from '@/components/back-office/AttentionRow';
import { formatMoney } from '@/lib/format/money';
import type { AlertSummary } from '@/lib/api/inventory-alerts';
import type { NearExpiryReport } from '@/lib/api/inventory-reports';

/**
 * `components/inventory/InventoryOverview.tsx` — HO-IMP-002 §8.1, restyled by HO-P4 S4 (11.5.2).
 * The attention rows at the top of Inventory & batches: batches expiring soon (and the value at
 * risk), items below their reorder point, all open alerts, and the active recalls — each only when
 * the server let the caller read it (a `403` simply leaves its row out). Every figure is the
 * server's; nothing is counted here. HO-P5 BG-17: "{count} consignments arriving in the next {withinDays}
 * days" links to the consignments filtered the same way, and is left out when the server sent no
 * `consignmentsArriving`.
 */
export function InventoryOverview({
  alerts,
  nearExpiry,
  activeRecalls,
}: {
  alerts: AlertSummary | undefined;
  nearExpiry: NearExpiryReport | undefined;
  activeRecalls: number | undefined;
}) {
  return (
    <section aria-label="Stock alerts" className="grid gap-2 md:grid-cols-2">
      {nearExpiry && (
        <AttentionRow
          tone={nearExpiry.rows.length > 0 ? 'danger' : 'success'}
          icon={<Clock size={16} />}
          text={`${nearExpiry.rows.length === 1 ? 'Batch expires' : 'Batches expire'} within ${nearExpiry.withinDays} days · value at risk ${formatMoney(nearExpiry.totalValueAtRisk)}`}
          count={nearExpiry.rows.length}
          href="/staff/inventory/reports/near-expiry"
        />
      )}
      {alerts && (
        <AttentionRow
          tone={(alerts.open.byKind.LowStock ?? 0) > 0 ? 'warning' : 'success'}
          icon={<AlertTriangle size={16} />}
          text="Items below reorder level"
          count={alerts.open.byKind.LowStock ?? 0}
          href="/staff/inventory/alerts"
        />
      )}
      {alerts && (
        <AttentionRow
          tone={alerts.open.total > 0 ? 'warning' : 'neutral'}
          icon={<AlertTriangle size={16} />}
          text="Open alerts"
          count={alerts.open.total}
          href="/staff/inventory/alerts"
        />
      )}
      {alerts?.consignmentsArriving && (
        <AttentionRow
          tone="neutral"
          icon={<Truck size={16} />}
          text={`${alerts.consignmentsArriving.count} ${alerts.consignmentsArriving.count === 1 ? 'consignment' : 'consignments'} arriving in the next ${alerts.consignmentsArriving.withinDays} ${alerts.consignmentsArriving.withinDays === 1 ? 'day' : 'days'}`}
          href={`/staff/procurement/consignments?arrivingWithinDays=${alerts.consignmentsArriving.withinDays}`}
        />
      )}
      {activeRecalls !== undefined && (
        <AttentionRow
          tone={activeRecalls > 0 ? 'danger' : 'neutral'}
          icon={<ShieldAlert size={16} />}
          text="Active recalls. Recalled stock is held everywhere and cannot be used."
          count={activeRecalls}
          href="/staff/inventory/recalls"
        />
      )}
    </section>
  );
}
