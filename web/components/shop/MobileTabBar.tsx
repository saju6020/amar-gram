'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, ShoppingBasket, Store, User } from 'lucide-react';
import { useCustomerSession } from '@/lib/hooks/useSession';
import { cn } from '@/lib/utils';

/** Which tab the current path belongs to. */
function currentTab(pathname: string): 'home' | 'shop' | 'basket' | 'account' | null {
  if (pathname === '/shop') return 'home';
  if (pathname.startsWith('/shop')) return 'shop';
  if (pathname === '/cart' || pathname.startsWith('/cart/')) return 'basket';
  if (pathname.startsWith('/portal') || pathname === '/sign-in') return 'account';
  return null;
}

/**
 * HO-P3 §8.3 `MobileTabBar` (ADR-FE-176): the phone's four-tab bar — Home, Shop, Basket, Account. Below
 * `md` only. The current tab carries `aria-current="page"`. It is **not rendered on `/cart`**, which has
 * its own sticky footer. A spacer the height of the bar is rendered with it, so the bar never covers the
 * last content (the footer's last link stays reachable).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useCustomerSession();
  if (pathname === '/cart' || pathname.startsWith('/cart/')) return null;

  const current = currentTab(pathname);
  const tabs = [
    { key: 'home', label: 'Home', href: '/shop', Icon: House },
    { key: 'shop', label: 'Shop', href: '/shop/products', Icon: Store },
    { key: 'basket', label: 'Basket', href: '/cart', Icon: ShoppingBasket },
    { key: 'account', label: 'Account', href: session ? '/portal' : '/sign-in', Icon: User },
  ] as const;

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Shop sections"
        data-testid="mobile-tab-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="m-0 grid list-none grid-cols-4 p-0">
          {tabs.map(({ key, label, href, Icon }) => {
            const isCurrent = current === key;
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-xs font-semibold no-underline',
                    isCurrent ? 'text-leaf-ink' : 'text-ink-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-7 w-14 place-items-center rounded-pill',
                      isCurrent && 'bg-leaf-soft',
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
