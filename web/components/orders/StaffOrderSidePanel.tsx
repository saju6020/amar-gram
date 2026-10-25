'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { Panel } from '@/components/back-office/Panel';
import { Amount } from '@/components/billing/Amount';
import { QueryBoundary } from '@/components/billing/QueryBoundary';
import { Button } from '@/components/ui/button';
import { describeOrderingError } from '@/lib/api/errors';
import type { StaffOrderAction, StaffOrderDetail } from '@/lib/api/staff-orders';
import { fulfilmentLabel, formatOrderWhen, orderActionLabel, orderStatusLabel, paymentMethodLabel } from '@/lib/format/orders';
import { formatDateOnly } from '@/lib/format/time';
import { useMarkReadyForCollection, useStaffOrder, useStartPacking } from '@/lib/hooks/useStaffOrders';
import { ApprovePaymentPanel } from './ApprovePaymentPanel';
import { OrderStatusBadge } from './OrderStatusBadge';
import { StaffOrderDialogs, type StaffOrderDialogKind } from './StaffOrderDialogs';

/**
 * `components/orders/StaffOrderSidePanel.tsx` — HO-P4 S2 (§11.3.3), US-ORD-09/10/19. The selected order
 * beside the workbench list. It reads the one order the URL names (`?order=`), so a refetch of the list
 * never clears it, and it refetches on its own every 30 s like the detail page.
 *
 * - The **pick list** is each line's server allocations (batch, expiry, location) in the order the
 *   server sent them. The ticks are local state keyed by order id and only gate the local *Start packing*
 *   button; they are not persisted (BG-4) and survive a refetch because this component stays mounted.
 * - The **next action** is the first of the order's `allowedActions` that this panel offers (ADR-FE-093);
 *   nothing is derived from the status. Everything else (shipment, reallocation, refund, delivery
 *   failure) stays on the full order page, one link away.
 * - "Cancel order" appears only when the server allows `Cancel`. All dialogs are the existing ones.
 */
const NEXT_ACTIONS: StaffOrderAction[] = ['ConfirmPayment', 'StartPacking', 'Dispatch', 'MarkReadyForCollection', 'RecordDelivery'];

function Allocations({ order, lineId }: { order: StaffOrderDetail; lineId: string }) {
  const line = order.lines.find((l) => l.lineId === lineId);
  if (!line) return null;
  if (line.allocations.length === 0) return <span className="block text-xs text-ink-muted">Not allocated to a batch yet.</span>;
  return (
    <span className="block text-xs text-ink-muted">
      {line.allocations.map((a) => (
        <span key={`${a.batchId}-${a.locationId}`} className="block">
          Batch {a.batchNumber}
          {a.expiresOn ? ` · expires ${formatDateOnly(a.expiresOn)}` : ''} · {a.locationName}
          {line.allocations.length > 1 ? ` · ${a.quantity} unit${a.quantity === 1 ? '' : 's'}` : ''}
        </span>
      ))}
    </span>
  );
}

function PickList({
  order,
  ticks,
  onToggle,
  tickable,
}: {
  order: StaffOrderDetail;
  ticks: Record<string, boolean>;
  onToggle: (lineId: string) => void;
  tickable: boolean;
}) {
  if (order.lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-ink-muted">
        {tickable ? 'Pick list (first-expiry batch suggested)' : 'Items'}
      </h3>
      <ul aria-label={tickable ? 'Pick list' : 'Items on this order'} className="m-0 flex list-none flex-col gap-2 p-0">
        {order.lines.map((line) => {
          const name = `${line.productName} ${line.variantLabel}`.trim();
          const text = (
            <>
              <strong className="text-sm text-ink">{line.quantity} × {name}</strong>
              <Allocations order={order} lineId={line.lineId} />
            </>
          );
          return (
            <li key={line.lineId}>
              {tickable ? (
                <label className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] bg-surface-page px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 flex-none accent-leaf"
                    checked={ticks[line.lineId] === true}
                    onChange={() => onToggle(line.lineId)}
                  />
                  <span className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">{text}</span>
                </label>
              ) : (
                <div className="rounded-[var(--radius-md)] bg-surface-page px-3 py-2 leading-snug [overflow-wrap:anywhere]">{text}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Ticks = Record<string, Record<string, boolean>>;

function SidePanelBody({
  order,
  ticksByOrder,
  onTicksChange,
}: {
  order: StaffOrderDetail;
  ticksByOrder: Ticks;
  onTicksChange: (update: (current: Ticks) => Ticks) => void;
}) {
  const [dialog, setDialog] = useState<StaffOrderDialogKind | null>(null);
  const [reallocLine, setReallocLine] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startPacking = useStartPacking();
  const ready = useMarkReadyForCollection(order.id);

  const allowed = new Set<string>(order.allowedActions);
  const next = NEXT_ACTIONS.find((a) => allowed.has(a) && !(a === 'ConfirmPayment' && order.heldPayment));
  const ticks = ticksByOrder[order.id] ?? {};
  const allTicked = order.lines.every((l) => ticks[l.lineId] === true);
  const tickable = allowed.has('StartPacking');
  const busy = startPacking.isPending || ready.isPending;
  const gated = next === 'StartPacking' && !allTicked;

  async function direct(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
    } catch (failure) {
      setError(describeOrderingError(failure));
    }
  }

  function perform(action: StaffOrderAction) {
    setNotice(null);
    switch (action) {
      case 'ConfirmPayment': return setDialog('transfer');
      case 'StartPacking': return void direct(() => startPacking.mutateAsync(order.id));
      case 'Dispatch': return setDialog('dispatch');
      case 'MarkReadyForCollection': return void direct(() => ready.mutateAsync());
      case 'RecordDelivery': return setDialog('delivery');
      default: return undefined;
    }
  }

  const f = order.fulfilment;
  const address = [f.line1, f.line2, f.city, f.district, f.postalCode].filter(Boolean).join(', ');
  const who = order.customerAnonymised ? 'Customer anonymised' : f.recipientName;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 text-sm text-ink-muted">
        <strong className="text-ink [overflow-wrap:anywhere]">
          {order.customerId && !order.customerAnonymised ? (
            <Link href={`/staff/customers/${order.customerId}`} className="text-ink hover:underline">{who}</Link>
          ) : (
            who
          )}
          {f.recipientPhone ? ` · ${f.recipientPhone}` : ''}
        </strong>
        {address && <span className="[overflow-wrap:anywhere]">{address}</span>}
        {f.pickupBranchName && <span>Collect at {f.pickupBranchName}</span>}
        <span>
          {fulfilmentLabel(order.fulfilmentMethod)}
          {f.slotDate && f.slotWindow ? ` · ${formatDateOnly(f.slotDate)}, ${f.slotWindow}` : ''} · {paymentMethodLabel(order.paymentMethod)}
        </span>
        {f.deliveryInstructions && <span className="[overflow-wrap:anywhere]">Note: {f.deliveryInstructions}</span>}
      </div>

      <PickList
        order={order}
        ticks={ticks}
        tickable={tickable}
        onToggle={(lineId) =>
          onTicksChange((current) => ({
            ...current,
            [order.id]: { ...(current[order.id] ?? {}), [lineId]: !(current[order.id]?.[lineId] ?? false) },
          }))
        }
      />

      <div className="flex items-baseline justify-between gap-3 border-t border-surface-sunken pt-3">
        <span className="text-ink">Total</span>
        <strong className="font-display text-[22px] text-ink">
          <Amount money={order.totals.grandTotal} />
        </strong>
      </div>

      <ApprovePaymentPanel order={order} />

      {error && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">{error}</p>}
      {notice && <p role="status" className="rounded-[var(--radius-sm)] bg-leaf-soft p-3 text-sm font-semibold text-leaf-ink">{notice}</p>}

      {next && (
        <div className="flex flex-col gap-1">
          <Button className="h-12 w-full text-base" onClick={() => perform(next)} disabled={busy || gated} aria-describedby={gated ? 'side-panel-tick-hint' : undefined}>
            {orderActionLabel(next, order.fulfilmentMethod)}
          </Button>
          {gated && (
            <p id="side-panel-tick-hint" className="text-xs text-ink-muted">
              Tick every item to start packing.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {order.fulfilmentMethod !== 'Counter' && (
          <ActionLink href={`/staff/orders/${order.id}/packing-slip`} variant="outline">
            Print packing slip
          </ActionLink>
        )}
        <ActionLink href={`/staff/orders/${order.id}`} variant="outline">
          Open full order
        </ActionLink>
        {allowed.has('Cancel') && (
          <Button variant="ghost" className="text-danger-ink" onClick={() => setDialog('cancel')} disabled={busy}>
            Cancel order
          </Button>
        )}
      </div>

      <ol aria-label="Status history" className="m-0 flex list-none flex-col gap-1.5 border-t border-surface-sunken p-0 pt-3 text-[13px] text-ink-muted">
        {order.statusHistory.map((entry, index) => (
          <li key={`${entry.changedOn}-${index}`}>
            <span className="font-semibold text-ink">{orderStatusLabel(entry.to)}</span> · {formatOrderWhen(entry.changedOn, order.branchTimeZoneId)} · {entry.changedByName ?? 'The system'}
          </li>
        ))}
      </ol>

      <StaffOrderDialogs
        order={order}
        dialog={dialog}
        onDialogChange={setDialog}
        reallocateLineId={reallocLine}
        onReallocateAny={() => { setReallocLine(undefined); setDialog('reallocate'); }}
        onNotice={setNotice}
      />
    </div>
  );
}

export function StaffOrderSidePanel({ orderId }: { orderId: string }) {
  const query = useStaffOrder(orderId);
  // Ticks, keyed by order id and then line id, live here so switching to another order and back keeps them.
  const [ticksByOrder, setTicksByOrder] = useState<Ticks>({});
  return (
    <QueryBoundary query={query} notFoundTitle="Order not found" notFoundDescription="This order may belong to another branch." loadingLabel="Loading the order…">
      {(order) => (
        <Panel title={`Order ${order.orderNumber}`} actions={<OrderStatusBadge status={order.status} />}>
          <SidePanelBody key={order.id} order={order} ticksByOrder={ticksByOrder} onTicksChange={setTicksByOrder} />
        </Panel>
      )}
    </QueryBoundary>
  );
}
