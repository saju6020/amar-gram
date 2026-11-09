'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { QueryBoundary } from '@/components/billing/QueryBoundary';
import { Button } from '@/components/ui/button';
import { describeOrderingError } from '@/lib/api/errors';
import type { StaffOrderAction, StaffOrderDetail as OrderDetail, StaffOrderLine } from '@/lib/api/staff-orders';
import { formatOrderWhen, orderActionLabel, orderChannelLabel } from '@/lib/format/orders';
import { useMarkPacked, useMarkReadyForCollection, useStaffOrder, useStartPacking } from '@/lib/hooks/useStaffOrders';
import { ApprovePaymentPanel } from './ApprovePaymentPanel';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderSummary } from './OrderSummary';
import { StaffOrderDialogs, type StaffOrderDialogKind } from './StaffOrderDialogs';
import {
  CustomerFulfilmentPanel,
  PaymentsPanel,
  ShipmentPanel,
  StaffHistoryPanel,
  StaffLinesPanel,
} from './StaffOrderPanels';

/**
 * `components/orders/StaffOrderDetail.tsx` — ⭐ HO-ORD-002 §11.8, ADR-FE-093. The action bar is rendered
 * **only from the server's `allowedActions`** (plus the held-payment panel when a transfer waits for a
 * second person); no action is invented from the status. The order refetches every 30 s (UI-5); the
 * dialogs live here, not under the buttons, so a refetch that removes an action never closes a dialog
 * someone is typing in. A `403` shows the permission-denied state.
 */
const PRIMARY: StaffOrderAction[] = ['ConfirmPayment', 'StartPacking', 'Dispatch', 'MarkPacked', 'MarkReadyForCollection', 'RecordDelivery', 'RecordDeliveryFailure', 'Refund'];

function Detail({ order }: { order: OrderDetail }) {
  const [dialog, setDialog] = useState<StaffOrderDialogKind | null>(null);
  const [reallocLine, setReallocLine] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startPacking = useStartPacking();
  const ready = useMarkReadyForCollection(order.id);
  const packed = useMarkPacked(order.id);
  const open = (next: StaffOrderDialogKind | null) => setDialog(next);
  const allowed = new Set<string>(order.allowedActions);
  const fulfilmentWork = allowed.has('StartPacking') || allowed.has('MarkPacked') || allowed.has('Dispatch') || allowed.has('MarkReadyForCollection');

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
      case 'ConfirmPayment': return open('transfer');
      case 'StartPacking': return void direct(() => startPacking.mutateAsync(order.id));
      case 'Dispatch': return open('dispatch');
      case 'MarkReadyForCollection': return void direct(() => ready.mutateAsync());
      case 'MarkPacked': return void direct(() => packed.mutateAsync());
      case 'RecordDelivery': return open('delivery');
      case 'RecordDeliveryFailure': return open('failure');
      case 'Refund': return open('refund');
      default: return undefined;
    }
  }

  const bar = PRIMARY.filter((a) => allowed.has(a) && !(a === 'ConfirmPayment' && order.heldPayment));
  const busy = startPacking.isPending || ready.isPending || packed.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/staff/orders" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent-ink no-underline hover:underline">
        <ChevronLeft size={14} aria-hidden="true" />
        Orders
      </Link>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatOrderWhen(order.placedOn, order.branchTimeZoneId, true)} · ${order.channel === 'Counter' ? 'Counter sale' : orderChannelLabel(order.channel)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            {order.fulfilmentMethod !== 'Counter' && (
              <ActionLink href={`/staff/orders/${order.id}/packing-slip`} variant="outline">
                Packing slip
              </ActionLink>
            )}
          </>
        }
      />
      {(bar.length > 0 || allowed.has('Cancel')) && (
        <div role="group" aria-label="Order actions" className="flex flex-wrap gap-2">
          {bar.map((action) => (
            <Button key={action} onClick={() => perform(action)} disabled={busy} variant={action === 'Refund' || action === 'MarkPacked' ? 'secondary' : 'primary'}>
              {orderActionLabel(action, order.fulfilmentMethod)}
            </Button>
          ))}
          {allowed.has('Cancel') && (
            <Button variant="destructive" onClick={() => open('cancel')} disabled={busy}>
              Cancel order
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">{error}</p>}
      {notice && <p role="status" className="rounded-[var(--radius-sm)] bg-accent-soft p-3 text-sm font-semibold text-accent-ink">{notice}</p>}
      <ApprovePaymentPanel order={order} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <StaffLinesPanel
            order={order}
            onReallocate={fulfilmentWork ? (line: StaffOrderLine) => { setReallocLine(line.lineId); open('reallocate'); } : undefined}
          />
          <ShipmentPanel order={order} onEditTracking={() => open('tracking')} />
          <StaffHistoryPanel order={order} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-label="Order totals">
            <OrderSummary totals={order.totals} discountCode={order.discountCode} serviceLevel={order.fulfilment.serviceLevel} fulfilment={order.fulfilmentMethod} />
          </Panel>
          <CustomerFulfilmentPanel order={order} />
          <PaymentsPanel order={order} />
        </div>
      </div>

      <StaffOrderDialogs
        order={order}
        dialog={dialog}
        onDialogChange={open}
        reallocateLineId={reallocLine}
        onReallocateAny={() => { setReallocLine(undefined); open('reallocate'); }}
        onNotice={setNotice}
      />
    </div>
  );
}

export function StaffOrderDetail({ orderId }: { orderId: string }) {
  const query = useStaffOrder(orderId);
  return (
    <QueryBoundary query={query} notFoundTitle="Order not found" notFoundDescription="This order may belong to another branch." loadingLabel="Loading the order…">
      {(order) => <Detail order={order} />}
    </QueryBoundary>
  );
}
