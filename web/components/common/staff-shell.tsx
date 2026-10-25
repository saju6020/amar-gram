'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  ChevronDown,
  Building2,
  Calendar,
  CalendarOff,
  ChartColumn,
  Copy,
  House,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  PackageCheck,
  PanelLeftClose,
  Receipt,
  Settings,
  Settings2,
  Shield,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Store,
  Truck,
  Undo2,
  UserPlus,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { navRegistry } from '@/nav';
import type { NavArea } from '@/nav/types';
import {
  activeStaffHref,
  groupStaffNav,
  type StaffNavSection,
} from '@/components/common/staff-nav-groups';
import { useStaffSession } from '@/lib/hooks/useSession';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Button } from '@/components/ui/button';
import { HearthLogo } from '@/components/hearth/HearthLogo';
import { ActiveBranchPicker } from '@/components/branches/ActiveBranchPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Below `sm` (640px, Tailwind's default breakpoint), the fixed w-64 (256px) sidebar plus any real
// content (a form, a DataTable's Previous/Next pager, …) doesn't fit UI-1's 360px floor — verified
// by the scaffold handover's E18. Below `sm`, the in-flow `<aside>` is therefore now ALWAYS the collapsed
// w-16 (64px) rail — a pure CSS fact (`w-16` with no `sm:`-gated width class overriding it below
// `sm`), true from the very first byte of server-rendered HTML, through hydration, with no JS
// timing involved (E18's own root cause was a *default* that depended on JS having run at all).
// It can no longer widen at all below `sm`, so E18's overflow, and every later hand-rolled-drawer
// finding built on top of it (scrim keyboard escape, `inert`-on-siblings, focus return, the
// out-of-tree toast), cannot recur structurally — there is nothing below `sm` left to trap focus
// inside by hand.
//
// The rail's own "Expand menu" button instead opens the full nav in a Radix `Dialog` rendered as a
// left sheet (`components/ui/dialog.tsx`'s `sheet-left` variant) — a real modal, so focus-trapping,
// `Escape`-to-close, overlay-click-to-close, focus-return-to-trigger and hiding the rest of the
// document from assistive tech all come from Radix itself (the scaffold handover §8.5), not from a second
// hand-rolled implementation of each.
//
// At `sm` and up, nothing here changes: the in-flow sticky aside is w-64 expanded or w-16
// collapsed, via its own always-mounted toggle. `collapsed` only ever affects `sm:`-prefixed
// classes, so its initial value (`false`, matching the CSS default `sm:w-64`) produces identical
// server and first-client-render markup — no hydration mismatch, and no JS-decided default below
// `sm` either.
//
// HO-P4 §8.2 (ADR-FE-181/182), the approved back-office design: the aside also carries the outlet
// picker (`ActiveBranchPicker variant="sidebar"`, always mounted so the active-branch seed effect
// runs on every staff page; hidden in the rail and when collapsed, shown at the top of the sheet)
// and, at its foot, the signed-in person (initials, name, roles, Sign out). The old top header is
// gone at `sm` and up. Below `sm` the 64px rail has no room for Sign out, so a slim top bar keeps
// the page title and the same "Sign out" button; only one of the two is ever displayed.
/** An item with no `roles` is for everyone; otherwise the member of staff needs one of them. */
export function canSeeNavItem(
  item: { roles?: readonly string[] },
  roleIds: readonly string[],
): boolean {
  return !item.roles || item.roles.some((role) => roleIds.includes(role));
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  // HO-ACC-002 §11.9/ADR-FE-004: `lib/identity.ts` is gone — the signed-in staff member's name
  // comes from the same session query `StaffSessionGuard` (the enclosing layout) already
  // resolved, shared via the TanStack Query cache (no extra request).
  const { data: session } = useStaffSession();
  const roleIds = session?.roleIds ?? [];

  // If the window is resized past `sm` while the below-`sm` sheet is open (e.g. rotating a device,
  // or widening a resizable window), leaving it open would strand the user in a nav-only modal
  // that hides the rest of the page — including the full in-flow nav that's now sitting right
  // behind it, already showing the same links. Closing it is harmless: `sm`+ never depended on
  // `sheetOpen` for its own layout (that stays pure CSS, see above), so this only ever discards an
  // open *interactive* overlay after hydration has already run — it cannot reintroduce E18's
  // pre-hydration timing race, which was about the default *layout*, not a user-opened dialog.
  useEffect(() => {
    if (!sheetOpen) return;
    const query = window.matchMedia('(min-width: 640px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setSheetOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [sheetOpen]);

  // CODE_REVIEW gate MEDIUM (the scaffold handover, 2nd pass): `StaffShell` is a persistent App Router layout
  // component, so `sheetOpen` otherwise survives any route change that doesn't go through one of
  // the sheet's own `SheetNav` links — most notably the browser's Back/Forward buttons, which are
  // chrome, not page DOM, so neither the dialog's overlay nor its focus trap can intercept them. A
  // user could open the sheet, press Back, and land on the previous page with the modal nav sheet
  // still open on top of it, still trapping Tab/Shift+Tab. Closing on every pathname change covers
  // Back/Forward and any other non-link navigation (e.g. `router.push` from elsewhere), not only
  // the in-sheet-link case `onNavigate` already handles.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // The current page's link stays in view in a long menu (e.g. Team & settings at the bottom).
  useEffect(() => {
    document.querySelector('aside [aria-current="page"]')?.scrollIntoView?.({ block: 'center' });
  }, [pathname]);

  // Per-item `audience` (nav/types.ts) overrides the area's own audience, for an area whose
  // single `audience: 'both'` mixes staff-only and portal-only screens in one items array — falls
  // back to the area's audience when an item doesn't set one.
  const sections: NavArea[] = navRegistry
    .map((area) => ({
      ...area,
      items: area.items.filter(
        (item) => (item.audience ?? area.audience) !== 'portal' && canSeeNavItem(item, roleIds),
      ),
    }))
    .filter((area) => area.items.length > 0);
  // Presented by daily job, not by build area (staff-nav-groups.ts, owner 2026-10-16).
  const groups = groupStaffNav(sections);
  const activeHref = activeStaffHref(groups, pathname ?? '');
  const activeLabel =
    groups.flatMap((g) => g.items).find((item) => item.href === activeHref)?.label ?? null;
  // Groups open and close (owner, 2026-10-16): only the current page's group starts open, so the
  // menu fits without a scrollbar; it appears only once the opened groups need it. Arriving at a
  // page in a closed group opens that group; nothing is closed for the user.
  const activeGroupKey =
    groups.find((g) => g.items.some((item) => item.href === activeHref))?.key ?? null;
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
    () => new Set(activeGroupKey ? [activeGroupKey] : []),
  );
  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (prev.has(activeGroupKey) ? prev : new Set(prev).add(activeGroupKey)));
  }, [activeGroupKey]);
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex min-h-screen bg-surface-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-sm)] focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <aside
        className={cn(
          'sticky top-0 flex h-screen w-16 flex-shrink-0 flex-col border-r border-leaf-ink bg-leaf-ink text-leaf-soft transition-[width] duration-200',
          !collapsed && 'sm:w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 flex-shrink-0 items-center justify-center gap-2 border-b border-leaf px-3',
            !collapsed && 'sm:justify-between sm:px-4',
          )}
        >
          {/* Owner, 2026-10-19: the same Amar Gram logo as everywhere else, sized to the sidebar. */}
          <HearthLogo
            variant="portal"
            href="/staff"
            accentClassName="text-leaf-soft"
            className={cn(
              'sr-only min-w-0 gap-2 text-base text-leaf-soft focus-visible:outline-leaf-soft',
              !collapsed && 'sm:not-sr-only',
            )}
          />

          {/* Below sm: opens the nav sheet (a real modal Dialog — see above). At sm and up: the
              ordinary in-flow collapse/expand toggle. Both always mounted, one per viewport, so a
              click never swaps the focused element's identity out from under the keyboard
              (TEST gate, 2nd pass) — each is CSS-hidden at the other viewport, never unmounted. */}
          <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Expand menu">
                <Menu size={18} aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent variant="sheet-left">
              <DialogHeader className="mb-2 flex-row items-center justify-between gap-2">
                <DialogTitle>Menu</DialogTitle>
              </DialogHeader>
              <DialogDescription className="sr-only">
                Amar Gram staff navigation, every area.
              </DialogDescription>
              {/* The sheet is light; the picker is styled for the leaf aside, so it sits on a leaf card. */}
              <div className="mb-3 rounded-[var(--radius-md)] bg-leaf-ink pb-3 empty:hidden">
                <ActiveBranchPicker variant="sidebar" />
              </div>
              <NavSections
                sections={groups}
                activeHref={activeHref}
                openGroups={openGroups}
                onToggleGroup={toggleGroup}
                mode="full"
                onNavigate={() => setSheetOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="icon"
            className="hidden text-leaf-soft hover:bg-leaf hover:text-leaf-soft focus-visible:outline-leaf-soft sm:inline-flex"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? (
              <Menu size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Back-office tag and outlet picker: no room in the rail, so only the expanded aside shows them. */}
        <div className={cn('hidden', !collapsed && 'sm:block')}>
          <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-leaf-soft">
            Back office
          </p>
          <div className="px-1">
            <ActiveBranchPicker variant="sidebar" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <NavSections
            sections={groups}
            activeHref={activeHref}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            mode="compact"
            collapsed={collapsed}
          />
        </div>

        {session && (
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-center gap-2.5 border-t border-leaf px-2 py-3',
              !collapsed && 'sm:justify-start sm:px-4',
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-9 flex-none place-items-center rounded-full bg-leaf-soft text-sm font-bold text-leaf-ink"
            >
              {initialsOf(session.fullName)}
            </span>
            <div
              className={cn('hidden min-w-0 flex-1 items-center gap-2', !collapsed && 'sm:flex')}
            >
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <strong className="truncate text-sm text-surface">{session.fullName}</strong>
                <span className="truncate text-xs text-leaf-soft">
                  {session.roleIds.join(', ')}
                </span>
              </div>
              <SignOutButton
                audience="staff"
                className="h-9 flex-none px-2 text-sm text-leaf-soft underline hover:bg-leaf hover:text-leaf-soft focus-visible:outline-leaf-soft"
              />
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Below `sm` only: the rail has no room for the title or Sign out (the aside footer has them at sm+). */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:hidden">
          <p className="min-w-0 truncate font-display text-base font-semibold text-ink">
            {activeLabel ?? 'Amar Gram staff'}
          </p>
          {session && <SignOutButton audience="staff" />}
        </header>

        <main id="main-content" className="min-w-0 flex-1 px-7 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Initials for the sidebar avatar: the first letters of the first and last words of the name. */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

/** Area files name their icons as lucide strings (nav/types.ts); the shell maps them here. */
const NAV_ICONS: Record<string, LucideIcon> = {
  'bar-chart': ChartColumn,
  boxes: Boxes,
  building: Building2,
  calendar: Calendar,
  'calendar-off': CalendarOff,
  'chart-column': ChartColumn,
  copy: Copy,
  home: House,
  inbox: Inbox,
  'layout-dashboard': LayoutDashboard,
  mail: Mail,
  package: Package,
  'package-check': PackageCheck,
  receipt: Receipt,
  settings: Settings,
  'settings-2': Settings2,
  shield: Shield,
  'shopping-basket': ShoppingBasket,
  'shopping-cart': ShoppingCart,
  store: Store,
  truck: Truck,
  undo: Undo2,
  'user-plus': UserPlus,
  'user-search': UserSearch,
  users: Users,
};

/**
 * The one renderer for both the always-in-flow aside nav and the below-`sm` sheet's nav
 * (ARCHITECTURE gate LOW): one link per item with its icon, the current page
 * marked (`aria-current="page"`, a teal tint), grouped by daily job (staff-nav-groups.ts).
 *
 * `mode="compact"` is the aside: below `sm` it is always the `w-16` rail (icons only, the label as
 * the link's name and tooltip); at `sm`+ it shows labels unless `collapsed`. `mode="full"` is the
 * sheet: always labels, and calls `onNavigate` on every link click so the sheet closes itself.
 */
function NavSections({
  sections,
  activeHref,
  openGroups,
  onToggleGroup,
  mode,
  collapsed = false,
  onNavigate,
}: {
  sections: StaffNavSection[];
  activeHref: string | null;
  openGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  mode: 'compact' | 'full';
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  // Text that only the expanded aside (or the sheet) has room for.
  const labelOnly = mode === 'compact' ? cn('hidden', !collapsed && 'sm:block') : undefined;
  const labelOnlyFlex = mode === 'compact' ? cn('hidden', !collapsed && 'sm:flex') : 'flex';
  // A closed group's links: gone from the sheet and the expanded aside, but the icon rail (below
  // sm, or collapsed) keeps every icon — it has no headings to open.
  // (The sheet uses the hidden attribute: those links are truly gone, for assistive tech too.)
  // The compact nav lives in the dark banana-leaf aside; the full nav is in the light sheet.
  const dark = mode === 'compact';
  const closedLinks = mode === 'full' || collapsed ? undefined : 'sm:hidden';

  if (sections.length === 0) {
    return (
      <p className={cn('px-2 text-sm', dark ? 'text-leaf-soft' : 'text-ink-muted', labelOnly)}>
        No areas registered yet — see web/README.md.
      </p>
    );
  }

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {sections.map((section) => {
        const open = !section.label || openGroups.has(section.key);
        const holdsCurrent = section.items.some((item) => item.href === activeHref);
        const listId = `staff-nav-${mode}-${section.key}`;
        return (
          <div
            key={section.key}
            className={cn('flex flex-col gap-0.5', open && section.label && 'pb-2')}
          >
            {section.label && (
              <>
                {/* text-ink-muted, not text-ink-faint (the scaffold handover E17/UI-6): 4.5:1 on the surface. */}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => onToggleGroup(section.key)}
                  className={cn(
                    'h-8 w-full items-center justify-between gap-2 rounded-[8px] px-2.5 text-left text-[11px] font-bold uppercase tracking-[0.09em] transition-colors',
                    dark
                      ? 'text-leaf-soft hover:bg-leaf focus-visible:outline-leaf-soft'
                      : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    labelOnlyFlex,
                  )}
                >
                  <span className="truncate">{section.label}</span>
                  <span className="flex flex-none items-center gap-2">
                    {!open && holdsCurrent && (
                      <span
                        aria-hidden="true"
                        className={cn('size-1.5 rounded-full', dark ? 'bg-leaf-soft' : 'bg-accent')}
                      />
                    )}
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={cn(
                        'transition-transform duration-200 motion-reduce:transition-none',
                        !open && '-rotate-90',
                      )}
                    />
                  </span>
                </button>
                {mode === 'compact' && (
                  <span
                    aria-hidden="true"
                    className={cn('mx-3 my-1 block h-px bg-leaf', !collapsed && 'sm:hidden')}
                  />
                )}
              </>
            )}
            <div
              id={listId}
              hidden={mode === 'full' && !open}
              className={cn('flex flex-col gap-0.5', !open && closedLinks)}
            >
              {section.items.map((item) => {
                const Icon = (item.icon && NAV_ICONS[item.icon]) || Sprout;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={mode === 'compact' ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    // The accessible name is always the full label, whichever width is showing.
                    aria-label={mode === 'compact' ? item.label : undefined}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-[var(--radius-md)] px-2.5 text-sm font-medium no-underline transition-colors',
                      mode === 'compact' && cn('justify-center', !collapsed && 'sm:justify-start'),
                      dark && 'focus-visible:outline-leaf-soft',
                      active
                        ? dark
                          ? 'bg-leaf-soft text-leaf-ink'
                          : 'bg-accent-soft text-accent-ink'
                        : dark
                          ? 'text-leaf-soft hover:bg-leaf'
                          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.2 : 1.8}
                      aria-hidden="true"
                      className={cn(
                        'flex-none',
                        dark
                          ? active
                            ? 'text-leaf-ink'
                            : 'text-leaf-soft'
                          : active
                            ? 'text-accent'
                            : 'text-ink-faint group-hover:text-ink-muted',
                      )}
                    />
                    <span
                      aria-hidden={mode === 'compact' ? true : undefined}
                      className={cn('truncate', labelOnly)}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
