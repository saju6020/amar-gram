import type { NavArea, NavItem } from '@/nav/types';

/**
 * How the staff sidebar groups its links (owner, 2026-10-16: "make the left menu professional";
 * regrouped to the approved back-office design by HO-P4 §8.2, ADR-FE-181).
 *
 * The nav registry stays one file per functional area (nav/areas/*.ts, see web/README.md) — that is
 * how the build was split, not how staff work. This file only PRESENTS those items: it regroups them
 * by daily job, in working order, and may give an item a clearer label, icon or a wider "active"
 * prefix. Links and role limits still come from the area files; an item no group lists lands in
 * "More", so a new area's links always show up.
 */
export interface StaffNavGroup {
  key: string;
  /** null = no heading (the Dashboard link at the top). */
  label: string | null;
  entries: readonly StaffNavEntry[];
}

interface StaffNavEntry {
  href: string;
  /** Shown instead of the area file's label (ADR-FE-181: no area file is renamed for presentation). */
  label?: string;
  /** lucide icon name overriding the area file's (where two items shared one). */
  icon?: string;
  /** Path prefix that marks this item active, when wider than its own href. */
  match?: string;
}

export const STAFF_NAV_GROUPS: readonly StaffNavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    entries: [{ href: '/staff', label: 'Dashboard', icon: 'layout-dashboard' }],
  },
  {
    key: 'sales',
    label: 'Sales',
    entries: [
      { href: '/staff/orders', label: 'Orders' },
      { href: '/staff/pos', label: 'Counter sale', icon: 'shopping-basket' },
      { href: '/staff/customers', label: 'Customers', icon: 'user-search' },
      { href: '/staff/subscriptions', label: 'Subscriptions', match: '/staff/subscriptions' },
      { href: '/staff/returns', label: 'Returns' },
      { href: '/staff/notifications', label: 'Messages', icon: 'inbox' },
      { href: '/staff/customers/new', label: 'Register walk-in' },
      { href: '/staff/customers/duplicates', label: 'Duplicate customers' },
    ],
  },
  {
    key: 'stock',
    label: 'Catalogue & stock',
    entries: [
      { href: '/staff/shop/products', label: 'Products', match: '/staff/shop' },
      { href: '/staff/inventory', label: 'Inventory & batches' },
      { href: '/staff/inventory/receipts', label: 'Goods receiving' },
      { href: '/staff/procurement/suppliers', label: 'Procurement', match: '/staff/procurement' },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    entries: [{ href: '/staff/billing', label: 'Billing & cash-up' }],
  },
  {
    key: 'admin',
    label: 'Insight & admin',
    entries: [
      { href: '/staff/reports', label: 'Reports', icon: 'chart-column' },
      {
        href: '/staff/admin/branches',
        label: 'Administration',
        icon: 'settings-2',
        match: '/staff/admin',
      },
      { href: '/staff/admin/staff-accounts', label: 'Staff accounts', icon: 'users' },
      { href: '/staff/leave', label: 'My leave', icon: 'calendar-off' },
    ],
  },
];

export interface StaffNavLink extends NavItem {
  /** Prefix that makes this link the current page. */
  match: string;
}

export interface StaffNavSection {
  key: string;
  label: string | null;
  items: StaffNavLink[];
}

/** The visible staff items (already role- and audience-filtered) arranged into the groups above. */
export function groupStaffNav(areas: readonly NavArea[]): StaffNavSection[] {
  const items = areas.flatMap((area) => area.items);
  const used = new Set<string>();
  const sections: StaffNavSection[] = [];
  for (const group of STAFF_NAV_GROUPS) {
    const links: StaffNavLink[] = [];
    for (const entry of group.entries) {
      const item = items.find((i) => i.href === entry.href);
      if (!item || used.has(item.href)) continue;
      used.add(item.href);
      links.push({
        ...item,
        label: entry.label ?? item.label,
        icon: entry.icon ?? item.icon,
        match: entry.match ?? item.href,
      });
    }
    if (links.length > 0) sections.push({ key: group.key, label: group.label, items: links });
  }
  const rest = items.filter((i) => !used.has(i.href));
  if (rest.length > 0)
    sections.push({
      key: 'more',
      label: 'More',
      items: rest.map((i) => ({ ...i, match: i.href })),
    });
  return sections;
}

/**
 * The href of the link for the current page: the longest matching prefix wins (so Staff accounts
 * beats Branches, whose prefix is /staff/admin, on /staff/admin/staff-accounts/42), and the Dashboard only ever matches /staff itself.
 */
export function activeStaffHref(
  sections: readonly StaffNavSection[],
  pathname: string,
): string | null {
  let best: StaffNavLink | null = null;
  for (const link of sections.flatMap((s) => s.items)) {
    const hit = link.match === '/staff' ? pathname === '/staff' : pathname.startsWith(link.match);
    if (hit && (!best || link.match.length > best.match.length)) best = link;
  }
  return best?.href ?? null;
}
