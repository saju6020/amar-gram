'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Panel } from '@/components/back-office/Panel';
import { Amount } from '@/components/billing/Amount';
import { Button, buttonVariants } from '@/components/ui/button';
import type { CounterSale } from '@/lib/api/pos';

/**
 * `components/pos/PosSaleComplete.tsx` — HO-ORD-002 §11.11; HO-P4 S2. The sale is recorded: order and
 * invoice number, the **change due** in large type (the server's figure), **Print receipt** (opens the
 * receipt route; focused so the keyboard path continues) and **New sale** (clears the basket, focus back
 * to scan).
 */
export function PosSaleComplete({ sale, onNewSale }: { sale: CounterSale; onNewSale: () => void }) {
  const printRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => printRef.current?.focus(), []);
  return (
    <Panel aria-label="Sale complete" as="div">
      <section aria-labelledby="pos-done" className="flex flex-col items-center gap-4 py-4 text-center">
        <span aria-hidden="true" className="grid h-20 w-20 place-items-center rounded-full bg-leaf-soft text-leaf">
          <Check size={38} strokeWidth={2.4} />
        </span>
        <h2 id="pos-done" className="font-display text-[26px] font-bold text-ink">Sale complete — {sale.orderNumber}</h2>
        <dl className="m-0 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-right text-ink-muted">Invoice</dt>
          <dd className="m-0 text-left">{sale.invoiceNumber}</dd>
          <dt className="text-right text-ink-muted">Total</dt>
          <dd className="m-0 text-left font-semibold"><Amount money={sale.grandTotal} /></dd>
        </dl>
        <p className="rounded-[var(--radius-md)] bg-leaf-soft px-4 py-2 text-2xl font-bold text-leaf-ink" role="status">
          Change due: <Amount money={sale.changeDue} />
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link ref={printRef} href={`/staff/pos/sales/${sale.orderId}/receipt`} className={buttonVariants({ className: 'h-11' })}>
            Print receipt
          </Link>
          <Button variant="secondary" className="h-11" onClick={onNewSale}>New sale</Button>
        </div>
      </section>
    </Panel>
  );
}
