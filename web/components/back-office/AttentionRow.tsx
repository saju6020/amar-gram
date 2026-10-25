import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_SURFACE, type BackOfficeTone } from './tone';

/**
 * HO-P4 §11.1 — a "needs attention" row (dashboard, inventory alerts): a tinted link with an icon,
 * the text and an optional count. The icon is decoration and `aria-hidden`; the text carries the
 * meaning, so the tone is never the only signal.
 */
export function AttentionRow({
  tone,
  icon,
  text,
  count,
  href,
}: {
  tone: BackOfficeTone;
  icon: ReactNode;
  text: string;
  count?: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-semibold no-underline hover:underline',
        TONE_SURFACE[tone],
      )}
    >
      <span aria-hidden="true" className="inline-flex flex-none items-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{text}</span>
      {count !== undefined && count !== null && (
        <span className="flex-none rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-ink">
          {count}
        </span>
      )}
      <ChevronRight size={16} aria-hidden="true" className="flex-none" />
    </Link>
  );
}
