'use client';

import { usePathname } from 'next/navigation';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';

/**
 * `components/orders/StaffOrdersTabs.tsx` — HO-ORD-002 §12.2. The awaiting-payment list, reconciliation
 * issues, pick list and refunds due are tabs of the staff Orders screens rather than sidebar entries
 * (the sidebar has *Orders*, *Returns* and *POS*). They are **routes**, so this is a `<nav>` of links
 * with `aria-current` (HO-P4 §7 UI-6), not an ARIA tablist: they work without scripting and are one
 * tab stop each.
 */
const TABS = [
  { key: '/staff/orders', href: '/staff/orders', label: 'Queue' },
  { key: '/staff/orders/awaiting-payment', href: '/staff/orders/awaiting-payment', label: 'Awaiting payment' },
  { key: '/staff/fulfilment/pick-list', href: '/staff/fulfilment/pick-list', label: 'Pick list' },
  { key: '/staff/refunds', href: '/staff/refunds', label: 'Refunds due' },
  { key: '/staff/orders/reconciliation', href: '/staff/orders/reconciliation', label: 'Reconciliation' },
];

export function StaffOrdersTabs() {
  const pathname = usePathname();
  return <UnderlineTabs mode="link" label="Order screens" items={TABS} value={pathname} />;
}
