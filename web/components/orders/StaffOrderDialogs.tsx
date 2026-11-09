'use client';

import { useRouter } from 'next/navigation';
import { RefundDialog } from '@/components/refunds/RefundDialog';
import type { StaffOrderDetail } from '@/lib/api/staff-orders';
import { useCancelStaffOrder } from '@/lib/hooks/useStaffOrders';
import { ConfirmTransferDialog } from './ConfirmTransferDialog';
import { DeliveryFailureDialog } from './DeliveryFailureDialog';
import { DispatchDialog, TrackingDialog } from './DispatchDialog';
import { OrderReasonDialog } from './OrderReasonDialog';
import { ReallocateLineDialog } from './ReallocateLineDialog';
import { RecordDeliveryDialog } from './RecordDeliveryDialog';

/**
 * `components/orders/StaffOrderDialogs.tsx` — HO-P4 S2. Every dialog a staff order can open, mounted in
 * one place and driven by the caller's `dialog` state. The order detail page and the workbench's side
 * panel both use it, so the two never drift apart. The dialogs live here, not under the buttons, so a
 * refetch that removes an action never closes a dialog someone is typing in (ADR-FE-027). Every dialog
 * is the existing one with its existing confirmation text.
 */
export type StaffOrderDialogKind =
  | 'transfer'
  | 'cancel'
  | 'dispatch'
  | 'tracking'
  | 'delivery'
  | 'failure'
  | 'refund'
  | 'reallocate';

export function StaffOrderDialogs({
  order,
  dialog,
  onDialogChange,
  reallocateLineId,
  onReallocateAny,
  onNotice,
}: {
  order: StaffOrderDetail;
  dialog: StaffOrderDialogKind | null;
  onDialogChange: (next: StaffOrderDialogKind | null) => void;
  reallocateLineId?: string;
  /** The dispatch dialog's "Reallocate a line" shortcut: open the reallocate dialog with no line chosen. */
  onReallocateAny: () => void;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const cancel = useCancelStaffOrder(order.id);
  const bind = (kind: StaffOrderDialogKind) => ({
    open: dialog === kind,
    onOpenChange: (next: boolean) => onDialogChange(next ? kind : null),
  });
  return (
    <>
      <ConfirmTransferDialog
        target={{
          orderId: order.id,
          orderNumber: order.orderNumber,
          version: order.version,
          amount: order.totals.grandTotal,
          zone: order.branchTimeZoneId,
          customerReference: order.customerTransferReference,
        }}
        {...bind('transfer')}
        onDone={(outcome) =>
          onNotice(
            outcome.awaitingApproval
              ? 'Recorded. A second staff member must approve it before the order is confirmed.'
              : 'Transfer confirmed. The order is now confirmed.',
          )
        }
      />
      <OrderReasonDialog
        {...bind('cancel')}
        title={`Cancel order ${order.orderNumber}`}
        consequence="The reserved items are released back to stock. Anything the customer has already paid becomes a refund due."
        confirmLabel="Cancel order"
        reasonLabel="Why is it being cancelled?"
        onSubmit={(note) => cancel.mutateAsync(note)}
      />
      <DispatchDialog orderId={order.id} {...bind('dispatch')} onReallocate={onReallocateAny} />
      <TrackingDialog orderId={order.id} current={order.shipment?.trackingNumber ?? null} {...bind('tracking')} />
      <RecordDeliveryDialog order={order} {...bind('delivery')} />
      <DeliveryFailureDialog
        orderId={order.id}
        fulfilmentMethod={order.fulfilmentMethod}
        {...bind('failure')}
        onReturnOpened={(id) => router.push(`/staff/returns/${id}`)}
      />
      <ReallocateLineDialog orderId={order.id} lines={order.lines} initialLineId={reallocateLineId} {...bind('reallocate')} />
      <RefundDialog orderId={order.id} orderNumber={order.orderNumber} {...bind('refund')} />
    </>
  );
}
