'use client';

import { forwardRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TenderMethod } from '@/lib/api/pos';
import { formatMoney } from '@/lib/format/money';
import { tenderMethodLabel } from '@/lib/format/orders';
import { cn } from '@/lib/utils';
import type { PosTender } from './types';

/**
 * `components/pos/PosTenderPanel.tsx` — ⭐ HO-ORD-002 §11.11, US-ORD-16; HO-P4 S2 (§11.3.6). Payments taken
 * at the counter: **Cash** (the money handed over — the server works out the change) and **Card
 * (terminal)** (the amount charged on the terminal and the **terminal slip number**, never a card number).
 * The tender is a radiogroup; the cash quick buttons only **fill the amount field**: "Exact" with the
 * server quote's total string, the others with fixed whole amounts. Amounts are kept as typed and nothing
 * is added up here, so whether they cover the total, and the change due, are the server's answer when the
 * sale is completed (no change is shown before that, BG-7). Keyboard path: `F2` focuses the amount;
 * **Enter** adds the payment and opens the review.
 */
const QUICK_AMOUNTS = ['1000.00', '1500.00', '2000.00'];

const TENDER_CHOICES: Array<{ method: TenderMethod; label: string }> = [
  { method: 'Cash', label: 'Cash' },
  { method: 'InStoreCard', label: 'Card (terminal)' },
];

export const PosTenderPanel = forwardRef<
  HTMLInputElement,
  {
    tenders: PosTender[];
    currencyCode: string;
    /** The server quote's total, as the string it sent; `null` until a quote exists. */
    exactAmount: string | null;
    onAdd: (tender: Omit<PosTender, 'id'>) => void;
    onRemove: (id: string) => void;
    onReview: () => void;
    disabled: boolean;
  }
>(function PosTenderPanel({ tenders, currencyCode, exactAmount, onAdd, onRemove, onReview, disabled }, ref) {
  const [method, setMethod] = useState<TenderMethod>('Cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add(): boolean {
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setError('Enter the amount as a number, like 1500.00.');
      return false;
    }
    if (method === 'InStoreCard' && !reference.trim()) {
      setError('Enter the card terminal slip reference.');
      return false;
    }
    setError(null);
    onAdd({ method, amount: amount.trim(), reference: method === 'InStoreCard' ? reference.trim() : '' });
    setAmount('');
    setReference('');
    return true;
  }

  const field = 'w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const quick: Array<{ key: string; label: string; value: string | null }> = [
    { key: 'exact', label: 'Exact', value: exactAmount },
    ...(method === 'Cash' ? QUICK_AMOUNTS.map((value) => ({ key: value, label: formatMoney({ amount: value, currencyCode }), value })) : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tender" className="grid grid-cols-2 gap-2">
        {TENDER_CHOICES.map((choice) => (
          <label
            key={choice.method}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border px-3 text-center text-sm font-semibold text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              method === choice.method ? 'border-2 border-leaf bg-leaf-soft' : 'border-border bg-surface',
            )}
          >
            <input
              type="radio"
              name="pos-tender-method"
              className="sr-only"
              checked={method === choice.method}
              onChange={() => {
                setMethod(choice.method);
                setError(null);
              }}
            />
            {choice.label}
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pos-tender-amount" className="text-[13px] font-semibold text-ink-muted">
          {method === 'Cash' ? `Cash handed over (${currencyCode})` : `Amount charged (${currencyCode})`}
        </label>
        <div role="group" aria-label="Quick amounts" className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q.key}
              type="button"
              disabled={disabled || q.value === null}
              aria-pressed={q.value !== null && amount === q.value}
              onClick={() => q.value !== null && setAmount(q.value)}
              className={cn(
                'min-h-11 flex-1 rounded-[var(--radius-md)] border px-2 text-sm font-semibold text-ink disabled:opacity-50',
                q.value !== null && amount === q.value ? 'border-2 border-leaf bg-leaf-soft' : 'border-border bg-surface',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <input
          ref={ref}
          id="pos-tender-amount"
          className={field}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (add()) onReview();
            }
          }}
        />
        <p className="text-xs text-ink-muted">Press F2 to jump here. Enter adds the payment and opens the review.</p>
      </div>
      {method === 'InStoreCard' && (
        <div className="flex flex-col gap-1">
          <label htmlFor="pos-tender-ref" className="text-[13px] font-semibold text-ink-muted">Terminal slip number</label>
          <input id="pos-tender-ref" className={field} maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
          <p className="text-xs text-ink-muted">The number on the terminal’s slip. Never type a card number.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
      <div>
        <Button variant="secondary" onClick={() => add()} disabled={disabled}>Add payment</Button>
      </div>
      {tenders.length > 0 && (
        <ul aria-label="Payments taken" className="m-0 flex list-none flex-col gap-1 p-0">
          {tenders.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {tenderMethodLabel(t.method)} {formatMoney({ amount: t.amount, currencyCode })}
                {t.reference ? ` · slip ${t.reference}` : ''}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onRemove(t.id)}>
                Remove<span className="sr-only"> {tenderMethodLabel(t.method)} payment</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
