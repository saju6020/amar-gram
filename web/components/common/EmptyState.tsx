import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineArtBasket } from '@/components/hearth/LineArtBasket';

/**
 * The warm-customer-layer illustration: the Hearth harvest basket (`LineArtBasket`, Amar Gram Phase 2) in a
 * `--warm-soft` disc. Shared by several customer-facing areas, so it lives here. Only ever meaningful inside
 * `[data-theme="customer"]`; never pass this as `EmptyState`'s icon on a staff screen (`--warm` contrast, and
 * the "staff empty states stay neutral" rule).
 */
export function EmptyWarmIllustration({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-16 w-16 flex-none items-center justify-center rounded-full bg-warm-soft text-warm-ink',
        className,
      )}
    >
      <LineArtBasket width={36} height={40} />
    </span>
  );
}

/** The default neutral icon for a staff (or icon-less) empty state — never the warm art. */
function NeutralIllustration({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-16 w-16 flex-none items-center justify-center rounded-full bg-surface-sunken text-ink-faint',
        className,
      )}
    >
      <Inbox size={28} aria-hidden="true" />
    </span>
  );
}

/**
 * `components/common/EmptyState.tsx` — the scaffold handover §11.7, Definition of Done: "`EmptyState` says
 * what to do next, not 'No data'." Every prop that isn't the title is deliberately there to force
 * that: `description` for the plain-language "why", `action` for the next step.
 *
 * `role="status" aria-live="polite"` matches `docs/design/shop/CatalogueNoResults.dc.html` — an
 * empty state that replaces a previous loading/list state is announced once, the same way a
 * search-result count changing is.
 */
export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Pass `<EmptyWarmIllustration />` on a portal screen with nothing to show yet; pass `null` to
   *  render no icon at all. Defaults to a neutral icon — staff empty states stay neutral. */
  icon?: React.ReactNode | null;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  const resolvedIcon = icon === undefined ? <NeutralIllustration /> : icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-5 rounded-[var(--radius-md)] border border-border bg-surface p-7',
        className,
      )}
    >
      {resolvedIcon}
      <div className="min-w-[220px] flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
