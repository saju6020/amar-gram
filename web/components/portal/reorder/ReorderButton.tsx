'use client';

import { useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDialogReturnFocus } from '@/components/ui/dialog';
import { useReorder } from '@/lib/hooks/useReorder';
import { ReorderResultDialog } from './ReorderResultDialog';

/**
 * `components/portal/reorder/ReorderButton.tsx` — HO-POR-002 U-B1, U-B7. One click, one request, a
 * result dialog. Whether the order may be re-ordered is the SERVER's flag (`canReorder` on the
 * order item, Orders' own `CustomerOrderRules.CanReorder`); this component adds no eligibility,
 * or stock logic (ADR-FE-123, section 20.7).
 *
 * While busy the button is `aria-disabled`, not `disabled`, so keyboard focus stays on it and the
 * dialog can return focus there; a ref guards the double click that lands before React re-renders.
 */
export interface ReorderButtonProps {
  orderId: string;
  orderNumber: string;
  canReorder: boolean;
  /** `compact` (the dashboard tile) or `pill`: the order page's 44px papaya pill (docs/design/store/MyOrders.dc.html). */
  appearance?: 'compact' | 'pill';
}

const WHY_NOT = 'Available once this order has been delivered or closed.';

export function ReorderButton({
  orderId,
  orderNumber,
  canReorder,
  appearance = 'compact',
}: ReorderButtonProps) {
  const reorder = useReorder(orderId);
  const [open, setOpen] = useState(false);
  const inFlight = useRef(false);
  const returnFocusRef = useDialogReturnFocus(open);

  function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    reorder.mutate(undefined, {
      onSettled: () => {
        inFlight.current = false;
        setOpen(true);
      },
    });
  }

  const pill = appearance === 'pill';
  const look = pill
    ? { variant: 'pill' as const, size: 'pillMd' as const }
    : { variant: 'secondary' as const, size: 'sm' as const };

  if (!canReorder) {
    const whyId = `reorder-why-${orderId}`;
    return (
      <>
        <Button
          variant={pill ? 'pillSecondary' : look.variant}
          size={look.size}
          disabled
          aria-describedby={whyId}
          aria-label={pill ? undefined : `Order ${orderNumber} again`}
        >
          <RotateCw size={14} aria-hidden="true" />
          Order again
        </Button>
        <span id={whyId} className="max-w-[230px] text-xs leading-snug text-ink-muted">
          {WHY_NOT}
        </span>
      </>
    );
  }

  const busy = reorder.isPending;
  return (
    <>
      <Button
        variant={look.variant}
        size={look.size}
        aria-disabled={busy || undefined}
        aria-label={busy || pill ? undefined : `Order ${orderNumber} again`}
        onClick={run}
      >
        <RotateCw size={14} aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : ''} />
        {busy ? 'Adding to basket…' : 'Order again'}
      </Button>
      <ReorderResultDialog
        open={open}
        onOpenChange={setOpen}
        orderNumber={orderNumber}
        result={reorder.data}
        error={reorder.error}
        returnFocusRef={returnFocusRef}
        onRetry={() => {
          setOpen(false);
          run();
        }}
      />
    </>
  );
}
