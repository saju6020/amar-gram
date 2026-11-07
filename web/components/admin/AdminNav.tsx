'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import { adminNavItems } from './adminNavItems';
import { cn } from '@/lib/utils';

/**
 * `components/admin/AdminNav.tsx` — HO-ADM-002 §11.1, ADR-FE-014 (renumbered — see that ADR's
 * note on the numbering collision with HO-ACC-002); HO-P4 §11.6.6. The admin section's own internal
 * navigation, rendered by `app/(staff)/staff/admin/layout.tsx`: four primary route tabs — Outlets,
 * Staff & roles, Roster, Settings — and every other `adminNavItems` entry in a "More" disclosure
 * list. All of it is filtered against the signed-in staff member's `roleIds` for presentation — U-A1
 * proves a hidden item's page is still refused by the server, not by this filter.
 *
 * The Roster tab has no single route (rosters are per branch, OQ-7): it opens the active branch's
 * roster when the caller passes `rosterHref`, otherwise the outlet cards.
 *
 * ARCH gate precedent (HO-ACC-002 §8.2 rule 4) — `components/admin/**` takes props/callbacks; the
 * page (`admin/layout.tsx`) wires `useStaffSession()` and passes `roleIds` in.
 */
const BRANCHES_HREF = '/staff/admin/branches';
const STAFF_HREF = '/staff/admin/staff-accounts';
const SETTINGS_HREF = '/staff/admin/settings';
const ROSTER_ROLES = ['Administrator', 'Reception', 'Inventory'];

/** Shown in the tabs, so left out of the "More" list. */
const PRIMARY_HREFS = new Set([BRANCHES_HREF, SETTINGS_HREF]);

const ROSTER_PATH = /^\/staff\/admin\/branches\/[^/]+\/roster(\/|$)/;

function isWithin(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ roleIds, rosterHref }: { roleIds: string[]; rosterHref?: string }) {
  const pathname = usePathname();
  const can = (roles: readonly string[]) => roles.some((role) => roleIds.includes(role));
  const visibleItems = adminNavItems.filter((item) => can(item.roles));
  const moreItems = visibleItems.filter((item) => !PRIMARY_HREFS.has(item.href));

  const tabs: Array<{ key: string; label: string; href: string }> = [];
  if (visibleItems.some((item) => item.href === BRANCHES_HREF)) {
    tabs.push({ key: 'outlets', label: 'Outlets', href: BRANCHES_HREF });
  }
  if (can(['Administrator'])) {
    tabs.push({ key: 'staff', label: 'Staff & roles', href: STAFF_HREF });
  }
  if (can(ROSTER_ROLES)) {
    tabs.push({ key: 'roster', label: 'Roster', href: rosterHref ?? BRANCHES_HREF });
  }
  if (visibleItems.some((item) => item.href === SETTINGS_HREF)) {
    tabs.push({ key: 'settings', label: 'Settings', href: SETTINGS_HREF });
  }

  if (tabs.length === 0 && moreItems.length === 0) return null;

  let current: string | undefined;
  if (ROSTER_PATH.test(pathname)) current = 'roster';
  else if (isWithin(pathname, BRANCHES_HREF)) current = 'outlets';
  else if (isWithin(pathname, STAFF_HREF)) current = 'staff';
  else if (isWithin(pathname, SETTINGS_HREF)) current = 'settings';

  const activeMore = moreItems.find((item) => isWithin(pathname, item.href));

  return (
    <div className="flex flex-col gap-3">
      {tabs.length > 0 && <UnderlineTabs mode="link" label="Administration" items={tabs} value={current} />}
      {moreItems.length > 0 && (
        // Keyed on the active entry so the list opens on the page you are on and closes elsewhere.
        <details key={activeMore?.href ?? 'none'} open={!!activeMore} className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-md)] px-1 text-sm font-semibold text-accent-ink">
            More administration
          </summary>
          <nav aria-label="More administration pages" className="mt-1">
            {/* One scrolling row below sm: an open list of 15 wrapped chips is ~700 px tall at 360 px and pushes the page's own content (the Backup page's two warnings, HO-XCT-002 E-D1) below the fold. */}
            <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {moreItems.map((item) => {
                const isActive = isWithin(pathname, item.href);
                return (
                  <li key={item.href} className="flex-none">
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold no-underline',
                        isActive
                          ? 'border-leaf-ink bg-leaf-ink text-leaf-soft'
                          : 'border-border bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </details>
      )}
    </div>
  );
}
