import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminNav } from '@/components/admin/AdminNav';

const nav = vi.hoisted(() => ({ pathname: '/staff/admin/branches' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}));

/** Opens the "More administration" disclosure, which holds every non-primary admin page. */
async function openMore() {
  await userEvent.setup().click(screen.getByText('More administration'));
}

describe('AdminNav — HO-ADM-002 §11.1, ADR-FE-014; HO-P4 §11.6.6', () => {
  it('U-A1 (rewritten): hides admin-only items for an inventory clerk', async () => {
    nav.pathname = '/staff/admin/branches';
    render(<AdminNav roleIds={['Inventory']} />);
    // Was a flat link row ('Branches' ... 'Settings' ... 'Leave approvals'); now Outlets is a tab and the rest is under More.
    expect(screen.getByRole('link', { name: 'Outlets' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff & roles' })).not.toBeInTheDocument();
    // Nothing else is visible to this role, so there is no "More" list at all.
    expect(screen.queryByText('More administration')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leave approvals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('hides the admin-only More entries from a shop manager but keeps the ones their role may use', async () => {
    nav.pathname = '/staff/admin/branches';
    render(<AdminNav roleIds={['ShopManager']} />);
    await openMore();
    const more = screen.getByRole('navigation', { name: 'More administration pages' });
    expect(within(more).getByRole('link', { name: 'Tax classes' })).toBeInTheDocument();
    expect(within(more).queryByRole('link', { name: 'System' })).not.toBeInTheDocument();
    expect(within(more).queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('U37: an administrator sees four link tabs and the other pages under More', async () => {
    nav.pathname = '/staff/admin/branches';
    render(<AdminNav roleIds={['Administrator']} />);
    const tabs = screen.getByRole('navigation', { name: 'Administration' });
    expect(within(tabs).queryAllByRole('tab')).toHaveLength(0);
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Outlets',
      'Staff & roles',
      'Roster',
      'Settings',
    ]);
    expect(within(tabs).getByRole('link', { name: 'Outlets' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/staff/admin/settings');
    await openMore();
    const more = screen.getByRole('navigation', { name: 'More administration pages' });
    for (const label of ['Leave approvals', 'Audit log', 'System', 'Message templates']) {
      expect(within(more).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(more).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('U37: the Roster tab opens the active branch roster, or the outlet cards without one (OQ-7)', () => {
    nav.pathname = '/staff/admin/branches/b1/roster';
    const { rerender } = render(<AdminNav roleIds={['Administrator']} rosterHref="/staff/admin/branches/b1/roster" />);
    const roster = screen.getByRole('link', { name: 'Roster' });
    expect(roster).toHaveAttribute('href', '/staff/admin/branches/b1/roster');
    expect(roster).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Outlets' })).not.toHaveAttribute('aria-current');
    rerender(<AdminNav roleIds={['Administrator']} />);
    expect(screen.getByRole('link', { name: 'Roster' })).toHaveAttribute('href', '/staff/admin/branches');
  });

  it('keeps the page you are on open in the More list, with aria-current', () => {
    nav.pathname = '/staff/admin/audit-log';
    render(<AdminNav roleIds={['Administrator']} />);
    const more = screen.getByRole('navigation', { name: 'More administration pages' });
    expect(within(more).getByRole('link', { name: 'Audit log' })).toHaveAttribute('aria-current', 'page');
  });

  it('a role with only the branch pages still gets the nav (Branches is visible to every staff role)', () => {
    nav.pathname = '/staff/admin/branches';
    render(<AdminNav roleIds={['Reception']} />);
    expect(screen.getByRole('navigation', { name: 'Administration' })).toBeInTheDocument();
  });
});
