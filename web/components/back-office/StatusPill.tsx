import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE_SURFACE, type BackOfficeTone } from './tone';

/**
 * HO-P4 §11.1 — a small rounded status label. The text is always rendered (colour is never the
 * only signal, UI-6); the optional icon is decoration and is hidden from assistive tech.
 */
export function StatusPill({
  tone,
  icon,
  children,
}: {
  tone: BackOfficeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONE_SURFACE[tone],
      )}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex flex-none items-center">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
