'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, House, LogOut, Package, Receipt, Star, User, type LucideIcon } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { useCustomerProfile } from '@/lib/hooks/useAccount';
import { useMyOrders } from '@/lib/hooks/useMyOrders';
import { useCustomerSession } from '@/lib/hooks/useSession';
import { cn } from '@/lib/utils';
import {
  ACCOUNT_GROUPS,
  PHONE_PILL_ORDER,
  activeAccountHref,
  type AccountIcon,
  type AccountLink,
} from './account-nav';

const ICONS: Record<AccountIcon, LucideIcon> = {
  home: House,
  package: Package,
  heart: Heart,
  star: Star,
  receipt: Receipt,
  user: User,
};

/** Orders that are still on their way (the count beside Orders). */
const OPEN_ORDER_STATUSES = new Set(['PendingPayment', 'Confirmed', 'Packing', 'Dispatched']);

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** "Member since 2026" — only once the profile has loaded. */
function useAccountSummary(): string | null {
  const profile = useCustomerProfile();
  const year = profile.data?.registeredOn
    ? new Date(profile.data.registeredOn).getFullYear()
    : null;
  return year ? `Member since ${year}` : null;
}

function useOpenOrderCount(): number {
  const orders = useMyOrders({ pageNumber: 1, pageSize: 50 });
  return orders.data?.items.filter((o) => OPEN_ORDER_STATUSES.has(o.status)).length ?? 0;
}

/**
 * The account menu as a card (docs/design/store/Account.dc.html, HO-P3 S4): the customer's initials, name and
 * "Member since", then the links (D-6 keeps Wishlist, My reviews and Billing). The current page is a leaf pill;
 * Sign out is the last row, in the danger ink.
 */
export function AccountSidebar() {
  const pathname = usePathname() ?? '';
  const active = activeAccountHref(pathname);
  const { data: session } = useCustomerSession();
  const summary = useAccountSummary();
  const openOrders = useOpenOrderCount();

  return (
    <aside className="hidden w-[260px] flex-none md:block">
      <div className="sticky top-4 flex flex-col gap-1 rounded-card border-[1.5px] border-border bg-surface p-4">
        {session && (
          <div className="mb-2 flex items-center gap-3 border-b-[1.5px] border-dashed border-border-strong px-2 pb-4 pt-2">
            <span
              aria-hidden="true"
              className="grid size-12 flex-none place-items-center rounded-full bg-leaf-soft font-display text-xl font-bold text-leaf-ink"
            >
              {initialsOf(session.fullName)}
            </span>
            <span className="flex min-w-0 flex-col leading-snug">
              <strong className="truncate text-ink">{session.fullName}</strong>
              {summary && <span className="text-[13px] text-ink-muted">{summary}</span>}
            </span>
          </div>
        )}
        <nav aria-label="Main" className="flex flex-col gap-1">
          {ACCOUNT_GROUPS.flatMap((group) => group.links).map((link) => (
            <SidebarLink
              key={link.href}
              link={link}
              current={link.href === active}
              count={link.href === '/portal/orders' ? openOrders : 0}
            />
          ))}
          <SignOutButton
            audience="customer"
            className="min-h-11 w-full justify-start gap-3 rounded-[14px] px-3.5 text-base font-medium text-danger-ink hover:bg-danger-bg [&_svg]:size-5"
          >
            <LogOut aria-hidden="true" />
          </SignOutButton>
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({
  link,
  current,
  count,
}: {
  link: AccountLink;
  current: boolean;
  count: number;
}) {
  const Icon = ICONS[link.icon];
  return (
    <Link
      href={link.href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-base font-medium no-underline transition-colors',
        current
          ? 'bg-leaf font-semibold text-leaf-soft'
          : 'text-ink hover:bg-leaf-soft hover:text-leaf-ink',
      )}
    >
      <Icon size={20} strokeWidth={current ? 2.1 : 1.8} aria-hidden="true" />
      {link.label}
      {count > 0 && (
        <span className="ml-auto grid h-[26px] min-w-[30px] place-items-center rounded-full bg-warm px-2 text-[13px] font-bold text-ink">
          <span className="sr-only">(</span>
          {count}
          <span className="sr-only"> on the way)</span>
        </span>
      )}
    </Link>
  );
}

/**
 * The approved design on a phone: the same pages as a row of pills under the header, starting with
 * Orders (where the account opens); the current one filled teal and scrolled into view. Sign out is
 * in the menu under the name.
 */
export function AccountPills() {
  const pathname = usePathname() ?? '';
  const active = activeAccountHref(pathname);
  const rowRef = useRef<HTMLElement>(null);
  const links = ACCOUNT_GROUPS.flatMap((g) => g.links).sort(
    (a, b) => PHONE_PILL_ORDER.indexOf(a.href) - PHONE_PILL_ORDER.indexOf(b.href),
  );

  useEffect(() => {
    rowRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    // Only one of the two "Main" navs is ever displayed: this one below md, the sidebar from md.
    <nav
      ref={rowRef}
      aria-label="Main"
      className="flex gap-2 overflow-x-auto border-b-[1.5px] border-border bg-surface px-3.5 py-2.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {links.map((link) => {
        const Icon = ICONS[link.icon];
        const current = link.href === active;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-semibold no-underline',
              current
                ? 'border-leaf bg-leaf text-leaf-soft'
                : 'border-border bg-surface text-ink-muted',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The account frame: on /portal pages for a signed-in customer, the pills (phone) or the sidebar
 * (desktop) beside the page; anywhere else in the group (checkout) just
 * the page, so a flow keeps its focus.
 */
export function AccountFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { data: session } = useCustomerSession();
  const inAccount = !!session && (pathname === '/portal' || pathname.startsWith('/portal/'));

  if (!inAccount) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-[1224px] px-4 py-8 md:px-8">
        {children}
      </main>
    );
  }
  return (
    <>
      <AccountPills />
      <div className="mx-auto flex w-full max-w-[1200px] items-start gap-8 px-3.5 py-5 md:px-6 md:py-8">
        <AccountSidebar />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
