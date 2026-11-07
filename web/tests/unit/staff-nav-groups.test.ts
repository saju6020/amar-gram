import { describe, expect, it } from 'vitest';
import { activeStaffHref, groupStaffNav } from '@/components/common/staff-nav-groups';
import { navRegistry } from '@/nav';
import type { NavArea } from '@/nav/types';

// 2026-10-16 (owner: "make the staff left menu professional"): the shell regroups the per-area
// registry by daily job and marks the current page.
const staffAreas: NavArea[] = navRegistry.map((area) => ({
  ...area,
  items: area.items.filter((item) => (item.audience ?? area.audience) !== 'portal'),
}));

describe('groupStaffNav', () => {
  const groups = groupStaffNav(staffAreas);

  it('puts the Dashboard first, then the design groups in working order', () => {
    expect(groups[0]).toMatchObject({
      label: 'Overview',
      items: [{ href: '/staff', label: 'Dashboard' }],
    });
    expect(groups.map((g) => g.label)).toEqual([
      'Overview',
      'Sales',
      'Catalogue & stock',
      'Money',
      'Insight & admin',
    ]);
  });

  it('shows the design labels over the area files (ADR-FE-181)', () => {
    const labelOf = (href: string) =>
      groups.flatMap((g) => g.items).find((i) => i.href === href)?.label;
    expect(labelOf('/staff/pos')).toBe('Counter sale');
    expect(labelOf('/staff/notifications')).toBe('Messages');
    expect(labelOf('/staff/inventory')).toBe('Inventory & batches');
    expect(labelOf('/staff/inventory/receipts')).toBe('Goods receiving');
    expect(labelOf('/staff/billing')).toBe('Billing & cash-up');
    expect(labelOf('/staff/admin/branches')).toBe('Administration');
    expect(labelOf('/staff/leave')).toBe('My leave');
  });

  it('keeps every staff link exactly once (none lost, none doubled)', () => {
    const shown = groups.flatMap((g) => g.items.map((i) => i.href)).sort();
    const registered = staffAreas.flatMap((a) => a.items.map((i) => i.href)).sort();
    expect(shown).toEqual(registered);
  });

  it('gives every link an icon', () => {
    expect(groups.flatMap((g) => g.items).filter((i) => !i.icon)).toEqual([]);
  });

  it('puts a link no group lists under "More", so a new area still shows', () => {
    const extra: NavArea = {
      key: 'subscriptions',
      label: 'Subscriptions',
      audience: 'staff',
      items: [{ label: 'Plans', href: '/staff/plans', icon: 'receipt' }],
    };
    const withExtra = groupStaffNav([...staffAreas, extra]);
    expect(withExtra.at(-1)).toMatchObject({ label: 'More', items: [{ href: '/staff/plans' }] });
  });

  it('drops a group whose links the member of staff cannot see', () => {
    const onlyCustomers = groupStaffNav([
      {
        key: 'accounts',
        label: 'Accounts',
        audience: 'staff',
        items: [{ label: 'Register customer', href: '/staff/customers/new' }],
      },
    ]);
    expect(onlyCustomers.map((g) => g.label)).toEqual(['Sales']);
  });
});

describe('activeStaffHref', () => {
  const groups = groupStaffNav(staffAreas);
  const cases: Array<[string, string | null]> = [
    ['/staff', '/staff'],
    ['/staff/orders', '/staff/orders'],
    ['/staff/orders/123', '/staff/orders'],
    ['/staff/shop/products/abc', '/staff/shop/products'],
    ['/staff/procurement/purchase-orders', '/staff/procurement/suppliers'],
    ['/staff/admin/settings', '/staff/admin/branches'],
    ['/staff/admin/staff-accounts/42', '/staff/admin/staff-accounts'],
    ['/staff/inventory/receipts/new', '/staff/inventory/receipts'],
    ['/staff/inventory/stock/abc', '/staff/inventory'],
    ['/staff/customers', '/staff/customers'],
    ['/staff/customers/new', '/staff/customers/new'],
    ['/staff/something-new', null],
  ];
  it.each(cases)('%s marks %s', (pathname, expected) => {
    expect(activeStaffHref(groups, pathname)).toBe(expected);
  });
});

// HO-P6 S2 (U33): the Subscriptions link sits in Sales right after Customers, is current on its sub-routes, and moves no other link.
describe('Subscriptions entry (HO-P6 S2)', () => {
  it('is in Sales after Customers, current on /unpaid and a detail page, with no other group changed', () => {
    const groups = groupStaffNav(staffAreas);
    const sales = groups.find((g) => g.key === 'sales')!;
    const hrefs = sales.items.map((i) => i.href);
    expect(hrefs.indexOf('/staff/subscriptions')).toBe(hrefs.indexOf('/staff/customers') + 1);
    expect(sales.items.find((i) => i.href === '/staff/subscriptions')).toMatchObject({ label: 'Subscriptions', icon: 'repeat' });
    expect(activeStaffHref(groups, '/staff/subscriptions')).toBe('/staff/subscriptions');
    expect(activeStaffHref(groups, '/staff/subscriptions/unpaid')).toBe('/staff/subscriptions');
    expect(activeStaffHref(groups, '/staff/subscriptions/5b000000-0000-0000-0000-000000000011')).toBe('/staff/subscriptions');
    for (const key of ['overview', 'stock', 'money', 'admin']) {
      expect(groups.find((g) => g.key === key)!.items.map((i) => i.href)).not.toContain('/staff/subscriptions');
    }
    expect(groups.some((g) => g.key === 'more')).toBe(false);
  });
});
