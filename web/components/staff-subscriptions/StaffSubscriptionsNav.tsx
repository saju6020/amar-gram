import Link from 'next/link';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/staff/subscriptions', label: 'All' },
  { href: '/staff/subscriptions/unpaid', label: 'Unpaid' },
] as const;

/**
 * HO-P6 S2 (§11.3.3, OQ-13). A link nav between the two subscription lists, not tabs: each is its own route (UI-6,
 * HO-P4 §7). The current one carries `aria-current="page"`.
 */
export function StaffSubscriptionsNav({ current }: { current: 'all' | 'unpaid' }) {
  return (
    <nav aria-label="Subscription lists" className="flex gap-1 border-b border-border">
      {LINKS.map((link, index) => {
        const active = (index === 0 ? 'all' : 'unpaid') === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold no-underline transition-colors',
              active
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
