import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TONE_BORDER, TONE_SURFACE, type BackOfficeTone } from './tone';

/**
 * HO-P4 §11.1 — one figure on a card. `value` arrives pre-formatted from the caller (money through
 * `AmountCell` / `formatMoney`; this component never formats or computes). The label is a heading
 * (level 2 unless the caller nests the tile deeper) so a screen-reader user can jump tile to tile.
 * With `href` the whole tile is one link.
 */
export function KpiTile({
  label,
  value,
  note,
  tone = 'neutral',
  href,
  headingLevel = 2,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: BackOfficeTone;
  href?: string;
  /** Additive to the §11.1 contract: the heading level of the label (default 2). */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const body = (
    <>
      <Heading className="text-[13px] font-semibold text-ink-muted">{label}</Heading>
      <p className="mt-1 font-display text-[28px] font-bold leading-tight text-ink [overflow-wrap:anywhere]">
        {value}
      </p>
      {note && (
        <p
          className={cn(
            'mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
            TONE_SURFACE[tone],
          )}
        >
          {note}
        </p>
      )}
    </>
  );
  const classes = cn(
    'block min-w-0 rounded-2xl border bg-surface p-4 text-ink no-underline',
    TONE_BORDER[tone],
    href && 'transition-colors hover:border-accent',
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
