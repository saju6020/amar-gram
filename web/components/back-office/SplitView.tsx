import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * HO-P4 §11.1 — list and detail side by side from 1024px up, stacked below. `detail={null}` hides
 * the detail column and the list takes the full width. `ratio` is list:detail (default `3:2`).
 * Each column is a labelled region so assistive tech can tell them apart.
 */
export function SplitView({
  list,
  detail,
  listLabel,
  detailLabel,
  ratio = '3:2',
}: {
  list: ReactNode;
  detail: ReactNode | null;
  listLabel: string;
  detailLabel: string;
  ratio?: '3:2' | '2:3';
}) {
  const hasDetail = detail !== null && detail !== undefined;
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <section
        aria-label={listLabel}
        className={cn(
          'min-w-0',
          hasDetail ? (ratio === '3:2' ? 'lg:basis-3/5' : 'lg:basis-2/5') : 'flex-1',
        )}
      >
        {list}
      </section>
      {hasDetail && (
        <section
          aria-label={detailLabel}
          className={cn('min-w-0', ratio === '3:2' ? 'lg:basis-2/5' : 'lg:basis-3/5')}
        >
          {detail}
        </section>
      )}
    </div>
  );
}
