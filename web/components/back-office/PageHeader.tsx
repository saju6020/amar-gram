import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

/**
 * HO-P4 §11.1 — the heading block every back-office page starts with: an optional eyebrow, the
 * page heading in the display face, an optional description, and the page's primary actions, which
 * wrap below the title on a narrow screen.
 *
 * `headingRef` is for pages that move focus to their heading on navigation; the heading then gets
 * `tabIndex={-1}` so it can take programmatic focus without joining the tab order.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  actionsClassName,
  headingLevel = 1,
  headingRef,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Extra classes for the actions row, e.g. `max-sm:w-full` so a search field can fill the phone's width. */
  actionsClassName?: string;
  headingLevel?: 1 | 2;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1';
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[13px] font-semibold text-accent-ink">{eyebrow}</p>}
        <Heading
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={cn(
            'font-display text-[30px] font-bold leading-tight text-ink [overflow-wrap:anywhere] sm:text-[32px]',
            headingRef && 'focus:outline-none',
          )}
        >
          {title}
        </Heading>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className={cn('flex flex-wrap items-center gap-2', actionsClassName)}>{actions}</div>}
    </header>
  );
}
