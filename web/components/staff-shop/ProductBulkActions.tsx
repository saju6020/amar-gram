'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { describeApiError } from '@/lib/api/errors';
import type { BulkProductAction, BulkProductStatusResult } from '@/lib/api/staff-shop';
import { CATALOGUE_CODE_MESSAGES } from './submitProductSection';

/** One finished bulk action, kept so the screen can say what happened to each product (BG-10). */
export interface BulkOutcome {
  result: BulkProductStatusResult;
  /** Product names by id, taken when the action was confirmed. */
  names: Record<string, string>;
}

const COPY: Record<
  BulkProductAction,
  {
    label: string;
    title: (n: number) => string;
    consequence: string;
    confirm: string;
    variant: 'primary' | 'destructive';
  }
> = {
  Publish: {
    label: 'Publish',
    title: (n) => `Publish ${n} ${n === 1 ? 'product' : 'products'}?`,
    consequence:
      'They appear in the shop once every publishing check passes. A product that is not ready stays as it is and is listed afterwards with the reason.',
    confirm: 'Publish',
    variant: 'primary',
  },
  Unpublish: {
    label: 'Hide from shop',
    title: (n) => `Hide ${n} ${n === 1 ? 'product' : 'products'} from the shop?`,
    consequence:
      'They disappear from the shop and go back to draft. Their content, prices and stock are kept, and they can be published again.',
    confirm: 'Hide from shop',
    variant: 'destructive',
  },
};

/**
 * HO-P5 BG-10 `ProductBulkActions` -- HO-P4 §11.4.3. The bar that appears once a row is ticked: how many are
 * selected, **Publish**, **Hide from shop** and Clear. Each action confirms first (UI-3), naming how many
 * products it touches, then makes ONE `bulk-status` call. The server answers 200 whatever the mix of outcomes,
 * so the result is the server's own: "{succeededCount} updated, {failedCount} not updated" and each failure's
 * product name with the server's message (rendered as text). Nothing is counted in the browser.
 */
export function ProductBulkActions({
  selectedIds,
  nameOf,
  onRun,
  onClear,
}: {
  selectedIds: string[];
  nameOf: (productId: string) => string;
  onRun: (action: BulkProductAction, productIds: string[]) => Promise<BulkProductStatusResult>;
  onClear: () => void;
}) {
  const [pending, setPending] = React.useState<BulkProductAction | null>(null);
  const [outcome, setOutcome] = React.useState<BulkOutcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const count = selectedIds.length;

  async function confirm() {
    const action = pending;
    setPending(null);
    if (!action) return;
    const ids = selectedIds;
    const names = Object.fromEntries(ids.map((id) => [id, nameOf(id)]));
    setError(null);
    setOutcome(null);
    try {
      const result = await onRun(action, ids);
      setOutcome({ result, names });
      onClear();
    } catch (e) {
      // 400 only for a malformed request (no ids, over 100, an unknown action): nothing was changed.
      setError(describeApiError(e, CATALOGUE_CODE_MESSAGES));
    }
  }

  return (
    <>
      {count > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-sunken px-4 py-3"
        >
          <p aria-live="polite" className="m-0 text-sm font-semibold text-ink">
            {count} selected
          </p>
          <Button variant="primary" size="sm" onClick={() => setPending('Publish')}>
            Publish
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPending('Unpublish')}>
            Hide from shop
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      {outcome && <BulkResult outcome={outcome} onDismiss={() => setOutcome(null)} />}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? COPY[pending].title(count) : ''}
        consequence={pending ? COPY[pending].consequence : ''}
        confirmLabel={pending ? COPY[pending].confirm : 'Confirm'}
        variant={pending ? COPY[pending].variant : 'primary'}
        onConfirm={confirm}
      />
    </>
  );
}

function BulkResult({ outcome, onDismiss }: { outcome: BulkOutcome; onDismiss: () => void }) {
  const { result, names } = outcome;
  const failures = result.items.filter((item) => !item.succeeded);
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm"
    >
      <p className="m-0 font-semibold text-ink">
        {result.succeededCount} updated, {result.failedCount} not updated
      </p>
      {failures.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-danger-ink">
          {failures.map((item) => (
            <li key={item.productId}>
              <span className="font-semibold">{names[item.productId] ?? item.productId}:</span>{' '}
              {item.message ?? 'It could not be changed.'}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
