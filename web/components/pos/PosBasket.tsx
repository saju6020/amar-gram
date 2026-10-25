'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Amount } from '@/components/billing/Amount';
import { Button } from '@/components/ui/button';
import type { CounterQuote } from '@/lib/api/pos';
import { describeExcludedReason } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format/money';
import type { BasketLine } from './types';

/**
 * `components/pos/PosBasket.tsx` — HO-ORD-002 §11.11. The basket rows: product, variant, the batch the
 * server says will be used, a quantity stepper with named buttons, remove, and the line total **from the
 * server's counter quote** (matched by SKU); a line the quote leaves out says why in words.
 */
/**
 * The quantity box keeps what is being typed as text and commits a whole number >= 1 on blur or Enter, so a cashier
 * can clear the box to type a new number without it snapping back to 1 (and appending a digit).
 */
function QuantityInput({ name, quantity, onCommit }: { name: string; quantity: number; onCommit: (quantity: number) => void }) {
  const [text, setText] = useState(String(quantity));
  const [editing, setEditing] = useState(false);
  const shown = editing ? text : String(quantity);
  function commit() {
    setEditing(false);
    const next = Number.parseInt(text, 10);
    if (Number.isInteger(next) && next >= 1 && next !== quantity) onCommit(next);
  }
  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      aria-label={`Quantity of ${name}`}
      value={shown}
      onFocus={() => {
        setText(String(quantity));
        setEditing(true);
      }}
      onChange={(e) => {
        setEditing(true);
        setText(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      className="h-10 w-14 rounded-[var(--radius-sm)] border-0 bg-transparent px-1 text-center text-base font-semibold text-ink"
    />
  );
}

export function PosBasket({
  lines,
  quote,
  onQuantity,
  onRemove,
}: {
  lines: BasketLine[];
  quote: CounterQuote | undefined;
  onQuantity: (skuId: string, quantity: number) => void;
  onRemove: (skuId: string) => void;
}) {
  if (lines.length === 0) {
    return <p className="rounded-[var(--radius-md)] border border-dashed border-border p-6 text-center text-sm text-ink-muted">Scan or tap a product to start.</p>;
  }
  return (
    <ul aria-label="Basket" className="m-0 flex list-none flex-col p-0">
      {lines.map((line) => {
        const name = `${line.productName} ${line.variantLabel}`.trim();
        const priced = quote?.lines.find((q) => q.skuId === line.skuId);
        const excluded = quote?.excludedLines.find((q) => q.skuId === line.skuId);
        return (
          <li key={line.skuId} className="flex flex-col gap-1 border-b border-surface-sunken py-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-40 leading-snug">
                <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{name}</p>
                {line.unitPrice && <p className="text-xs text-ink-muted">{formatMoney(line.unitPrice)} each</p>}
                {line.batchLabel && <p className="text-xs text-ink-muted">{line.batchLabel}</p>}
              </div>
              <div role="group" aria-label={`Quantity controls for ${name}`} className="flex items-center rounded-lg bg-surface-page">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-lg" aria-label={`Decrease quantity of ${name}`} disabled={line.quantity <= 1} onClick={() => onQuantity(line.skuId, line.quantity - 1)}>
                  <Minus size={16} aria-hidden="true" />
                </Button>
                <QuantityInput name={name} quantity={line.quantity} onCommit={(quantity) => onQuantity(line.skuId, quantity)} />
                <Button variant="ghost" size="icon" className="h-10 w-10 text-lg" aria-label={`Increase quantity of ${name}`} onClick={() => onQuantity(line.skuId, line.quantity + 1)}>
                  <Plus size={16} aria-hidden="true" />
                </Button>
              </div>
              <p className="min-w-16 text-right font-semibold">{priced ? <Amount money={priced.lineTotal} /> : <span className="text-ink-muted">…</span>}</p>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`Remove ${name}`} onClick={() => onRemove(line.skuId)}>
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
            {excluded && <p className="text-sm font-semibold text-danger-ink">{describeExcludedReason(excluded.reasonCode)}</p>}
          </li>
        );
      })}
    </ul>
  );
}
