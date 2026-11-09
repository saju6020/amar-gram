import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const VARIANT: Record<'primary' | 'outline' | 'danger-outline', string> = {
  primary: 'border border-accent bg-accent text-surface hover:bg-accent-ink',
  outline: 'border border-ink bg-surface text-ink hover:bg-surface-sunken',
  'danger-outline': 'border border-danger-ink bg-surface text-danger-ink hover:bg-danger-bg',
};

/** HO-P4 §11.1 — a `Link` that looks like a button (44px tall). Navigation only; use `Button` for actions. */
export function ActionLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'primary' | 'outline' | 'danger-outline';
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold no-underline transition-colors',
        VARIANT[variant],
      )}
    >
      {children}
    </Link>
  );
}
