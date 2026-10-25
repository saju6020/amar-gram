'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * HO-P4 §11.1 — the white card: 1px border, 16px radius. With a `title` it is a labelled region
 * (the heading names it); `aria-label` names an untitled one. `headingLevel` defaults to 2.
 */
export function Panel({
  title,
  titleId,
  headingLevel = 2,
  actions,
  padded = true,
  as: Tag = 'section',
  'aria-label': ariaLabel,
  children,
}: {
  title?: ReactNode;
  titleId?: string;
  headingLevel?: 2 | 3;
  actions?: ReactNode;
  padded?: boolean;
  as?: 'section' | 'aside' | 'div';
  'aria-label'?: string;
  children?: ReactNode;
}) {
  const generatedId = useId();
  const headingId = titleId ?? generatedId;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const labelled = Boolean(title) && Tag !== 'div';
  return (
    <Tag
      aria-labelledby={labelled && !ariaLabel ? headingId : undefined}
      aria-label={ariaLabel}
      className="min-w-0 rounded-2xl border border-border bg-surface"
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-sunken px-5 py-3.5">
          {title && (
            <Heading id={headingId} className="font-display text-lg font-semibold text-ink">
              {title}
            </Heading>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </Tag>
  );
}
