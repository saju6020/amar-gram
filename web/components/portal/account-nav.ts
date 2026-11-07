/**
 * The customer account menu (docs/design/store/Account.dc.html, HO-P3 S4): Overview, My orders, Wishlist, My reviews,
 * Billing, Profile & addresses (D-6 keeps the working features the design does not show), and Subscriptions after My
 * orders (HO-P6, ADR-FE-109). The same list drives the desktop sidebar and the phone's row of pills.
 */
export type AccountIcon = 'home' | 'package' | 'repeat' | 'heart' | 'star' | 'receipt' | 'user';

export interface AccountLink {
  label: string;
  href: string;
  icon: AccountIcon;
}

export interface AccountGroup {
  key: string;
  /** null = no heading (the design's menu is one flat list). */
  label: string | null;
  links: AccountLink[];
}

export const ACCOUNT_HOME = '/portal';
/** Where the account opens — the name on the shop and signing in land here (owner, 2026-10-17). */
export const ACCOUNT_LANDING = '/portal/orders';

export const ACCOUNT_GROUPS: readonly AccountGroup[] = [
  {
    key: 'menu',
    label: null,
    links: [
      { label: 'Overview', href: ACCOUNT_HOME, icon: 'home' },
      { label: 'My orders', href: '/portal/orders', icon: 'package' },
      { label: 'Subscriptions', href: '/portal/subscriptions', icon: 'repeat' },
      { label: 'Wishlist', href: '/portal/wishlist', icon: 'heart' },
      { label: 'My reviews', href: '/portal/reviews', icon: 'star' },
      { label: 'Billing', href: '/portal/billing', icon: 'receipt' },
      { label: 'Profile & addresses', href: '/portal/account/profile', icon: 'user' },
    ],
  },
];

/** The phone's row of pills starts with the landing page, My orders (the approved design). */
export const PHONE_PILL_ORDER: readonly string[] = [
  '/portal/orders',
  '/portal/subscriptions',
  '/portal/wishlist',
  '/portal/reviews',
  '/portal/billing',
  '/portal/account/profile',
  ACCOUNT_HOME,
];

/**
 * The link for the current page: the longest matching prefix wins; Overview only matches /portal
 * itself; any /portal/account/* page is Profile & addresses.
 */
export function activeAccountHref(pathname: string): string | null {
  if (pathname === ACCOUNT_HOME) return ACCOUNT_HOME;
  if (pathname.startsWith('/portal/account')) return '/portal/account/profile';
  let best: string | null = null;
  for (const link of ACCOUNT_GROUPS.flatMap((g) => g.links)) {
    if (link.href === ACCOUNT_HOME) continue;
    const hit = pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (hit && (!best || link.href.length > best.length)) best = link.href;
  }
  return best;
}
