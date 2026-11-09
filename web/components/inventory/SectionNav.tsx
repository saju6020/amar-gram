'use client';

import { usePathname } from 'next/navigation';
import { PillTabs } from '@/components/back-office/PillTabs';

export interface SectionNavItem {
  label: string;
  href: string;
  /** Optional count shown after the label as TEXT plus number (`Alerts 7 open`). */
  badge?: string | null;
  /** Staff roles the server grants the underlying action to — presentation only. */
  roles: readonly string[];
}

/**
 * `components/inventory/SectionNav.tsx` — HO-IMP-002 §11.1, ADR-FE-039. The tab row both sections
 * share, drawn as HO-P4 `PillTabs mode="link"` (a route section nav: `<nav>` + links, never `role=tab`). Items are filtered by the signed-in staff member's `roleIds` against a presentation map
 * that mirrors HO-IMP-001 §12.3 BY NAME ONLY — convenience, never authorization: every page still
 * renders `PermissionDeniedState` on a server `403`.
 */
export function SectionNav({
  label,
  items,
  roleIds,
}: {
  label: string;
  items: readonly SectionNavItem[];
  roleIds: readonly string[];
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => item.roles.some((role) => roleIds.includes(role)));
  if (visible.length === 0) return null;

  // The longest matching href wins, so the overview ("/staff/inventory") does not light up for
  // every child route.
  const activeHref = visible
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <PillTabs
      mode="link"
      label={label}
      value={activeHref}
      items={visible.map((item) => ({
        key: item.href,
        href: item.href,
        // The alert badge stays TEXT plus a number inside the one link name ("Alerts 7 open").
        label: item.badge ? `${item.label} ${item.badge}` : item.label,
      }))}
    />
  );
}
