'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { Panel } from '@/components/back-office/Panel';
import { Amount } from '@/components/billing/Amount';
import { QueryBoundary } from '@/components/billing/QueryBoundary';
import { Button } from '@/components/ui/button';
import { describeOrderingError, hasOrderingCode } from '@/lib/api/errors';
import type { StaffOrderAction, StaffOrderDetail, StaffOrderLine } from '@/lib/api/staff-orders';
import { fulfilmentLabel, formatOrderWhen, orderActionLabel, orderStatusLabel, paymentMethodLabel } from '@/lib/format/orders';
import { formatDateOnly } from '@/lib/format/time';
import { useMarkPacked, useMarkReadyForCollection, useSetLinePicked, useStaffOrder, useStartPacking } from '@/lib/hooks/useStaffOrders';
import { ApprovePaymentPanel } from './ApprovePaymentPanel';
import { OrderStatusBadge } from './OrderStatusBadge';
import { StaffOrderDialogs, type StaffOrderDialogKind } from './StaffOrderDialogs';

/**
 * `components/orders/StaffOrderSidePanel.tsx` — HO-P4 S2 (§11.3.3), US-ORD-09/10/19. The selected order
 * beside the workbench list. It reads the one order the URL names (`?order=`), so a refetch of the list
 * never clears it, and it refetches on its own every 30 s like the detail page.
 *
 * - The **pick list** is each line's server allocations (batch, expiry, location) in the order the
 *   server sent them. The ticks are the server's `picked` (HO-P5 BG-4): a click writes one idempotent
 *   `PUT …/picked`, shows at once and is put back with a message if the server refuses, so ticks survive a
 *   refetch, a reload and another device. They still gate the *Start packing* button here (HO-P4 U21).
 * - The **next action** is the first of the order's `allowedActions` that this panel offers (ADR-FE-093);
 *   nothing is derived from the status. *Mark packed* (the optional "packed, waiting for the rider" step)
 *   is offered beside it when allowed. Everything else (shipment, reallocation, refund, delivery
 *   failure) stays on the full order page, one link away.
 * - "Cancel order" appears only when the server allows `Cancel`. All dialogs are the existing ones.
 * - The rider note a customer left is shown as plain text (G4, OQ-7); it is never put in a link or in storage.
 */
const NEXT_ACTIONS: StaffOrderAction[] = ['ConfirmPayment', 'StartPacking', 'Dispatch', 'MarkReadyForCollection', 'RecordDelivery'];
/** The actions that mean the order is on the shelf side of fulfilment: the pick list is ticked while any is allowed. */
const SHELF_ACTIONS: StaffOrderAction[] = ['StartPacking', 'MarkPacked', 'Dispatch', 'MarkReadyForCollection'];
const LEFT_THE_SHELF = 'This order has already left the shelf.';

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
  isPicked,
  onToggle,
  tickable,
}: {
  order: StaffOrderDetail;
  isPicked: (line: StaffOrderLine) => boolean;
  onToggle: (lineId: string, picked: boolean) => void;
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
                    checked={isPicked(line)}
                    onChange={() => onToggle(line.lineId, !isPicked(line))}
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

function SidePanelBody({ order }: { order: StaffOrderDetail }) {
  const [dialog, setDialog] = useState<StaffOrderDialogKind | null>(null);
  const [reallocLine, setReallocLine] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startPacking = useStartPacking();
  const ready = useMarkReadyForCollection(order.id);
  const packed = useMarkPacked(order.id);
  const pick = useSetLinePicked(order.id);

  const allowed = new Set<string>(order.allowedActions);
  const next = NEXT_ACTIONS.find((a) => allowed.has(a) && !(a === 'ConfirmPayment' && order.heldPayment));
  // A tick the person just made shows in the same event (the checkbox is controlled, so it cannot wait for the cache to
  // notify); the server's `picked` takes over as soon as the write has settled, or the tick goes back if it was refused.
  const [justTicked, setJustTicked] = useState<Record<string, boolean>>({});
  const isPicked = (line: StaffOrderLine) => justTicked[line.lineId] ?? line.picked;
  const allTicked = order.lines.every(isPicked);
  const tickable = SHELF_ACTIONS.some((a) => allowed.has(a));
  const busy = startPacking.isPending || ready.isPending || packed.isPending;
  const gated = next === 'StartPacking' && !allTicked;

  async function togglePicked(lineId: string, picked: boolean) {
    setError(null);
    setJustTicked((current) => ({ ...current, [lineId]: picked }));
    try {
      await pick.mutateAsync({ lineId, picked });
    } catch (failure) {
      setError(hasOrderingCode(failure, 'InvalidOrderTransition') ? LEFT_THE_SHELF : describeOrderingError(failure));
    } finally {
      setJustTicked((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== lineId)));
    }
  }

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
      case 'MarkPacked': return void direct(() => packed.mutateAsync());
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
        {f.riderNote && <span className="[overflow-wrap:anywhere]">Note for the rider: <bdi>{f.riderNote}</bdi></span>}
        {order.packedOn && <span>Packed {formatOrderWhen(order.packedOn, order.branchTimeZoneId)}</span>}
      </div>

      <PickList order={order} tickable={tickable} isPicked={isPicked} onToggle={(lineId, picked) => void togglePicked(lineId, picked)} />

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
      {allowed.has('MarkPacked') && (
        <Button variant="secondary" className="h-11 w-full" onClick={() => perform('MarkPacked')} disabled={busy}>
          {orderActionLabel('MarkPacked', order.fulfilmentMethod)}
        </Button>
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
  // The pick-list ticks are the order's own `picked` flags, so they need no state here.
  const query = useStaffOrder(orderId);
  return (
    <QueryBoundary query={query} notFoundTitle="Order not found" notFoundDescription="This order may belong to another branch." loadingLabel="Loading the order…">
      {(order) => (
        <Panel title={`Order ${order.orderNumber}`} actions={<OrderStatusBadge status={order.status} />}>
          <SidePanelBody key={order.id} order={order} />
        </Panel>
      )}
    </QueryBoundary>
  );
}
