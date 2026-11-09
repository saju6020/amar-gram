'use client';

import { usePathname } from 'next/navigation';
import { PillTabs } from '@/components/back-office/PillTabs';

/**
 * `components/billing/BillingNav.tsx` — HO-BIL-002 §8.1, ADR-FE-079; HO-P4 §11.6.1. The Billing section's
 * own navigation (rendered by `app/(staff)/staff/billing/layout.tsx`) as route "pill" tabs: a link per
 * screen, daily jobs first (Approvals, Cash-up, Invoices), filtered by role for presentation only — a
 * hidden link's page is still refused by the server (`PermissionDeniedState`), and a shown one can
 * still be refused.
 */
const ACCOUNTS = ['Administrator', 'Accountant'] as const;

interface Item {
  label: string;
  href: string;
  roles?: readonly string[];
  exact?: boolean;
}

export const billingNavItems: Item[] = [
  { label: 'Approvals', href: '/staff/billing/approvals', roles: ACCOUNTS },
  { label: 'Cash-up', href: '/staff/billing/cash-up' },
  { label: 'Invoices', href: '/staff/billing/invoices' },
  { label: 'Overview', href: '/staff/billing', exact: true },
  { label: 'Payments', href: '/staff/billing/payments' },
  { label: 'Receivables', href: '/staff/billing/receivables' },
  { label: 'COD', href: '/staff/billing/reconciliation/cod', roles: ACCOUNTS },
  { label: 'Bank', href: '/staff/billing/reconciliation/bank', roles: ACCOUNTS },
  { label: 'Export', href: '/staff/billing/exports', roles: ACCOUNTS },
];

export function BillingNav({ roleIds }: { roleIds: string[] }) {
  const pathname = usePathname();
  const visible = billingNavItems.filter(
    (item) => !item.roles || item.roles.some((role) => roleIds.includes(role)),
  );
  const current = visible.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return (
    <PillTabs
      mode="link"
      label="Billing"
      value={current?.href}
      items={visible.map((item) => ({ key: item.href, label: item.label, href: item.href }))}
    />
  );
}
