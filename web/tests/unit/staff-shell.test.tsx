import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { StaffShell } from '@/components/common/staff-shell';

// HO-ACC-002 §11.9: StaffShell now reads the staff session via `useStaffSession()` (TanStack
// Query), replacing the removed `lib/identity.ts` (ADR-FE-004) — every render needs a
// QueryClientProvider ancestor. No staff session cookie is set in these tests, so the query
// resolves to `null` ("not signed in") — fine here, since none of these tests assert on the
// header's name/sign-out area, only on the nav sheet this file exists to cover.
function renderShell(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

// StaffShell watches `usePathname()` to close the below-sm sheet on any route change, including
// the browser's own Back/Forward (CODE_REVIEW gate MEDIUM, the scaffold handover 2nd pass) — see
// `staff-shell-sheet-closes-on-back-navigation.spec.ts` for the route-change regression itself.
// This file's own tests never navigate, so a fixed pathname is all they need.
let pathname = '/staff/inventory';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

/**
 * Rewritten for the Radix `Dialog`-based below-`sm` sheet (the scaffold handover TEST gate, 7th pass) — the
 * hand-rolled drawer this file used to cover (`override` tri-state, a `matchMedia`-driven `inert`
 * effect, a hand-rolled scrim, a manual `Escape` `keydown` listener) is gone. `StaffShell` now has
 * exactly two pieces of interactive state: `collapsed` (the sm+ in-flow toggle, unchanged in
 * behaviour from before) and `sheetOpen` (a real, controlled Radix `Dialog`). Focus-trapping,
 * `Escape`-to-close, overlay-click-to-close and focus-return-to-trigger for the sheet all come from
 * Radix itself — already covered by `components/ui/dialog.tsx`'s own contract and exercised
 * end-to-end by `confirm-dialog.test.tsx` — so this file tests StaffShell's own integration (which
 * button opens what, what the sheet contains, that a nav click closes it, and the sm+ toggle's
 * pre-existing focus-stability guarantee) rather than re-proving Radix's guarantees itself.
 *
 * jsdom applies no Tailwind CSS, so both the below-sm trigger and the sm+ toggle are always in the
 * DOM here (real browsers CSS-hide whichever doesn't match the current viewport — see the e2e
 * specs for that).
 */

// StaffShell only reaches `window.matchMedia` while the sheet is open, to close it if the viewport
// crosses to sm+ (jsdom has no matchMedia at all). `stubMatchMedia` records the registered
// listener so a test can simulate that resize.
function stubMatchMedia() {
  let listener: ((event: MediaQueryListEvent) => void) | null = null;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (_event: string, cb: (event: MediaQueryListEvent) => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return {
    fireMinWidth640: (matches: boolean) => listener?.({ matches } as MediaQueryListEvent),
  };
}

beforeEach(() => {
  pathname = '/staff/inventory';
  stubMatchMedia();
});

function mobileTrigger() {
  return screen.getByRole('button', { name: 'Expand menu' });
}

describe('StaffShell — sm and up collapse toggle (unchanged)', () => {
  it('starts expanded', () => {
    renderShell(<StaffShell>content</StaffShell>);
    // Two controls share the "expand/collapse menu" accessible name below sm vs sm+; the sm+ one
    // starts expanded (aria-expanded="true"), matching the pure-CSS `sm:w-60` default.
    const buttons = screen.getAllByRole('button', { name: /(expand|collapse) menu/i });
    const desktop = buttons.find((b) => b.getAttribute('aria-label') === 'Collapse menu');
    expect(desktop).toBeDefined();
    expect(desktop).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps focus on the same element across the first and later clicks', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    // Captured once, then re-checked by direct reference (not re-queried by role/name, since the
    // accessible name itself flips on click) — a remount would lose DOM focus even though the
    // element's props/label look the same afterwards, so `toHaveFocus()` on this same reference is
    // the identity check that matters here.
    const toggle = screen.getByRole('button', { name: 'Collapse menu' });

    await user.click(toggle);
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Expand menu');

    await user.click(toggle);
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse menu');
  });
});

describe('StaffShell — below-sm nav sheet (Radix Dialog)', () => {
  it('is closed by default and opens on the rail trigger', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(mobileTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has an accessible title and the full, un-abbreviated nav labels', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    await user.click(mobileTrigger());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(/menu/i);
    expect(screen.getByRole('link', { name: 'Inventory & batches' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Procurement' })).toBeInTheDocument();
  });

  it('closes when a nav link inside it is clicked', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    await user.click(mobileTrigger());

    await user.click(screen.getByRole('link', { name: 'Inventory & batches' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Escape closes it and returns focus to the rail trigger (Radix default)', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    const trigger = mobileTrigger();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes if the viewport crosses to sm+ while it is open, rather than stranding the user in it', async () => {
    const user = userEvent.setup();
    const { fireMinWidth640 } = stubMatchMedia();
    renderShell(<StaffShell>content</StaffShell>);
    await user.click(mobileTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireMinWidth640(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not touch matchMedia while closed', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    renderShell(<StaffShell>content</StaffShell>);
    expect(spy).not.toHaveBeenCalled();
  });
});

// Owner, 2026-10-16: groups open and close; only the current page's group starts open, so the
// menu needs no scrollbar at first. (pathname is /staff/inventory here, so Catalogue & stock is the
// open group.) Group names follow the approved back-office design (HO-P4 §8.2).
describe('StaffShell — expandable menu groups', () => {
  function asideGroup(name: string) {
    return within(document.querySelector('aside')!).getByRole('button', { name });
  }

  it("opens only the current page's group", () => {
    renderShell(<StaffShell>content</StaffShell>);
    expect(asideGroup('Catalogue & stock')).toHaveAttribute('aria-expanded', 'true');
    for (const closed of ['Overview', 'Sales', 'Money', 'Insight & admin'])
      expect(asideGroup(closed)).toHaveAttribute('aria-expanded', 'false');
    const current = document.querySelector('aside [aria-current="page"]');
    expect(current).toHaveAttribute('aria-label', 'Inventory & batches');
  });

  it('a group heading opens and closes its links, and says which list it controls', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    const customers = asideGroup('Sales');
    const list = document.getElementById(customers.getAttribute('aria-controls')!)!;
    expect(list).toHaveClass('sm:hidden');

    await user.click(customers);
    expect(customers).toHaveAttribute('aria-expanded', 'true');
    expect(list).not.toHaveClass('sm:hidden');

    await user.click(customers);
    expect(customers).toHaveAttribute('aria-expanded', 'false');
  });

  it('in the phone sheet a closed group hides its links and opening it shows them', async () => {
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    await user.click(mobileTrigger());
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Sales' }));
    expect(within(sheet).getByRole('link', { name: 'Orders' })).toBeVisible();
  });
});

// Owner, 2026-10-19: the staff area shows the same Amar Gram logo as the shop (badge + "Shop" tag), linking to /staff.
describe('StaffShell — the Amar Gram logo', () => {
  it('is the badge logo, linking to the staff home', () => {
    renderShell(<StaffShell>content</StaffShell>);
    const logo = screen.getByRole('link', { name: 'Amar Gram Shop' });
    expect(logo).toHaveAttribute('href', '/staff');
    expect(logo.querySelector('[aria-hidden="true"].bg-leaf')).not.toBeNull();
  });
});

// HO-P4 §8.2 / §15 (U1-U5): the groups, labels, active link and footer of the back-office sidebar.
function signedInAs(fullName: string, roleIds: string[]) {
  server.use(
    http.get('*/api/staff/session', () =>
      HttpResponse.json({
        staffAccountId: 's1',
        fullName,
        roleIds,
        issuedOn: '2026-10-14T00:00:00Z',
        lastActivityOn: '2026-10-14T00:00:00Z',
        idleExpiresOn: '2026-10-14T01:00:00Z',
        absoluteExpiresOn: '2026-10-14T08:00:00Z',
        idleTimeoutMinutes: 60,
        serverTime: '2026-10-14T00:00:00Z',
      }),
    ),
  );
}

describe('StaffShell — back-office sidebar (HO-P4 §8.2)', () => {
  function aside() {
    return within(document.querySelector('aside')!);
  }

  it('U1: shows the design groups in order', () => {
    renderShell(<StaffShell>content</StaffShell>);
    const headings = Array.from(document.querySelectorAll('aside button[aria-controls]')).map((b) =>
      b.textContent?.trim(),
    );
    expect(headings).toEqual([
      'Overview',
      'Sales',
      'Catalogue & stock',
      'Money',
      'Insight & admin',
    ]);
  });

  it('U2: shows the label overrides', async () => {
    const user = userEvent.setup();
    pathname = '/staff';
    renderShell(<StaffShell>content</StaffShell>);
    expect(aside().getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/staff');
    await user.click(aside().getByRole('button', { name: 'Sales' }));
    expect(aside().getByRole('link', { name: 'Counter sale' })).toHaveAttribute(
      'href',
      '/staff/pos',
    );
    await user.click(aside().getByRole('button', { name: 'Money' }));
    expect(aside().getByRole('link', { name: 'Billing & cash-up' })).toHaveAttribute(
      'href',
      '/staff/billing',
    );
  });

  it('U3: the longest prefix wins on the goods-receiving form', () => {
    pathname = '/staff/inventory/receipts/new';
    renderShell(<StaffShell>content</StaffShell>);
    expect(aside().getByRole('link', { name: 'Goods receiving' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(aside().getByRole('link', { name: 'Inventory & batches' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('U4: the sidebar footer shows the person, their roles and Sign out; the slim top bar keeps Sign out below sm', async () => {
    signedInAs('Rahima Akter', ['Administrator', 'Accountant']);
    renderShell(<StaffShell>content</StaffShell>);
    expect(await aside().findByText('Rahima Akter')).toBeInTheDocument();
    expect(aside().getByText('Administrator, Accountant')).toBeInTheDocument();
    expect(aside().getByText('RA')).toBeInTheDocument();
    // Two "Sign out" buttons exist (footer at sm+, top bar below sm; CSS shows one of them).
    const buttons = screen.getAllByRole('button', { name: 'Sign out' });
    expect(buttons).toHaveLength(2);
    const topBar = document.querySelector('header')!;
    expect(topBar).toHaveClass('sm:hidden');
    const topBarSignOut = within(topBar).getByRole('button', { name: 'Sign out' });
    expect(topBarSignOut).toBeEnabled();
    topBarSignOut.focus();
    expect(topBarSignOut).toHaveFocus();
  });

  it('keeps the skip link, the main landmark and its padding', () => {
    renderShell(<StaffShell>content</StaffShell>);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveClass('px-7', 'py-6');
  });

  it('shows the outlet picker at the top of the sheet when there are 2+ branches', async () => {
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b1', 'b2'],
          primaryBranchId: 'b1',
          activeBranchId: 'b1',
          activeBranchRefusal: null,
        }),
      ),
      http.get('*/api/admin/branches', () =>
        HttpResponse.json([
          {
            id: 'b1',
            code: 'A',
            name: 'Dhanmondi outlet',
            timeZoneId: 'Asia/Dhaka',
            isActive: true,
          },
          {
            id: 'b2',
            code: 'B',
            name: 'Chattogram warehouse',
            timeZoneId: 'Asia/Dhaka',
            isActive: true,
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderShell(<StaffShell>content</StaffShell>);
    await user.click(mobileTrigger());
    const sheet = screen.getByRole('dialog');
    expect(await within(sheet).findByRole('combobox', { name: 'Outlet' })).toBeInTheDocument();
  });
});
