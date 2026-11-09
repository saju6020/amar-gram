'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GreetingHeader } from '@/components/hearth/GreetingHeader';
import { cn } from '@/lib/utils';

/**
 * `components/account/AccountShell.tsx` — HO-ACC-002 §11.7, ADR-FE-008, restyled to docs/design/store/Profile.dc.html
 * (HO-P3 S4, ADR-FE-179). A route-based pill row (deep-linkable): Profile · Addresses · Notifications · Your data.
 * They stay four routes, not one page, so the unsaved-changes guard and the password-confirmed deletion page keep
 * working. Compliance-relevant settings (preferences, deletion) save explicitly on their own pages — this shell is
 * presentation only.
 */
const TABS = [
  { href: '/portal/account/profile', label: 'Profile' },
  { href: '/portal/account/addresses', label: 'Addresses' },
  { href: '/portal/account/notifications', label: 'Notifications' },
  { href: '/portal/account/data', label: 'Your data' },
] as const;

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      <GreetingHeader title="Profile & addresses" />
      <nav
        aria-label="Account"
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => {
          const isCurrent = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-pill border-[1.5px] px-4 text-sm font-semibold no-underline',
                isCurrent
                  ? 'border-leaf bg-leaf text-leaf-soft'
                  : 'border-border bg-surface text-ink hover:bg-leaf-soft',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
