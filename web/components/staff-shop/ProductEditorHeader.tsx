'use client';

import * as React from 'react';
import { Check, Circle, X } from 'lucide-react';
import Link from 'next/link';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { StatusPill } from '@/components/back-office/StatusPill';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type {
  ProductTransition,
  PublishChecklistItem,
  StaffProductDetail,
} from '@/lib/api/staff-shop';

const STATUS_TONE = { Draft: 'neutral', Active: 'success', Archived: 'warning' } as const;
const STATUS_TEXT = {
  Draft: 'Draft',
  Active: 'Active (in the shop)',
  Archived: 'Archived',
} as const;

/** HO-SHP-002 §11.6 `PublishChecklist` — each item with its message; blocking vs warning is stated
 *  in TEXT, met/unmet in text plus an icon (UI-6). The same list the server enforces. */
export const PublishChecklist = React.forwardRef<
  HTMLUListElement,
  { items: PublishChecklistItem[] }
>(function PublishChecklist({ items }, ref) {
  return (
    <ul
      ref={ref}
      tabIndex={-1}
      aria-label="Publish checklist"
      className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm focus:outline-2 focus:outline-accent"
    >
      {items.map((item) => (
        <li key={item.item} className="flex items-start gap-2">
          {item.isMet ? (
            <Check size={16} className="mt-0.5 flex-none text-accent" aria-hidden="true" />
          ) : item.isBlocking ? (
            <X size={16} className="mt-0.5 flex-none text-danger-ink" aria-hidden="true" />
          ) : (
            <Circle size={16} className="mt-0.5 flex-none text-warning-ink" aria-hidden="true" />
          )}
          <span>
            <span className="font-semibold">
              {item.isMet ? 'Done' : item.isBlocking ? 'Blocking' : 'Warning'}:
            </span>{' '}
            {item.message}
          </span>
        </li>
      ))}
    </ul>
  );
});

const ACTIONS: Record<StaffProductDetail['status'], ProductTransition[]> = {
  Draft: ['publish'],
  Active: ['unpublish', 'archive'],
  Archived: ['publish'],
};

const LABEL: Record<ProductTransition, string> = {
  publish: 'Publish',
  unpublish: 'Unpublish',
  archive: 'Archive',
};

export interface ProductEditorHeaderProps {
  product: StaffProductDetail;
  /** Runs the transition; rejects with the API error so the header can show it. */
  onTransition: (transition: ProductTransition) => Promise<unknown>;
  /** The server's refusal (`ProductNotPublishable` message) or a conflict, already worded. */
  error?: string | null;
  isConflict?: boolean;
  onReload: () => void;
}

/**
 * HO-SHP-002 §11.6 `ProductEditorHeader` — ADR-FE-034. Name, status in text, the server's publish
 * checklist and the status actions for the CURRENT status, each confirmed (UI-3) with what it
 * affects. **Publish is never disabled to express invalidity**: pressing it with an unmet blocking
 * item shows the server's refusal and moves focus to the checklist.
 *
 * HO-P4 §11.4.4/§11.4.5: a breadcrumb, the `h1`, a "Preview in shop" link (listed and active only)
 * and a "Status" card holding the status text, the checklist and the transition commands. The card
 * lives in the editor layout so the commands are reachable from every section, and exists once (a
 * status change is a command with `expectedVersion`, never a radio saved with the Details form).
 */
export function ProductEditorHeader({
  product,
  onTransition,
  error,
  isConflict,
  onReload,
}: ProductEditorHeaderProps) {
  const [pending, setPending] = React.useState<ProductTransition | null>(null);
  const checklistRef = React.useRef<HTMLUListElement>(null);
  const consequence: Record<ProductTransition, string> = {
    publish: `Publish ${product.name}? It will appear in the shop.`,
    unpublish: `Unpublish ${product.name}? It will disappear from the shop and go back to draft.`,
    archive: `Archive ${product.name}? It will disappear from the shop and can't be edited until restored.`,
  };

  // "Preview in shop" only for a product the shop actually shows (listed and active).
  const showPreview = product.status === 'Active' && product.listedOnStorefront;

  return (
    <header className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb">
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-ink-muted">
          <li>
            <Link href="/staff/shop/products" className="font-semibold text-accent">
              Products
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="[overflow-wrap:anywhere]">
            {product.name}
          </li>
        </ol>
      </nav>
      <PageHeader
        title={product.name}
        description={product.brand}
        actions={
          showPreview ? (
            <ActionLink href={`/shop/products/${product.slug}`} variant="outline">
              Preview in shop
            </ActionLink>
          ) : undefined
        }
      />
      <Panel
        title="Status"
        actions={ACTIONS[product.status].map((transition) => (
          <Button
            key={transition}
            variant={transition === 'publish' ? 'primary' : 'secondary'}
            onClick={() => setPending(transition)}
          >
            {LABEL[transition]}
          </Button>
        ))}
      >
        <div className="flex flex-col gap-3">
          <p className="m-0">
            <StatusPill tone={STATUS_TONE[product.status]}>
              {STATUS_TEXT[product.status]}
            </StatusPill>
          </p>
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink"
            >
              <span>{error}</span>
              {isConflict && (
                <Button variant="secondary" size="sm" onClick={onReload}>
                  Reload
                </Button>
              )}
            </div>
          )}
          <PublishChecklist ref={checklistRef} items={product.publishChecklist} />
        </div>
      </Panel>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? `${LABEL[pending]} this product?` : ''}
        consequence={pending ? consequence[pending] : ''}
        confirmLabel={pending ? LABEL[pending] : 'Confirm'}
        variant={pending === 'archive' || pending === 'unpublish' ? 'destructive' : 'primary'}
        onConfirm={async () => {
          const transition = pending;
          setPending(null);
          if (!transition) return;
          try {
            await onTransition(transition);
          } finally {
            // The refusal (if any) is rendered above; bring the checklist into view and focus.
            window.setTimeout(() => checklistRef.current?.focus(), 0);
          }
        }}
      />
    </header>
  );
}
