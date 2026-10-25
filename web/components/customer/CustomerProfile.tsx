'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ActionLink } from '@/components/back-office/ActionLink';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import type { StaffCustomer } from '@/lib/api/staff-customers';
import { CustomerDetail } from './CustomerDetail';

type ProfileTab = 'orders' | 'billing';

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'billing', label: 'Billing' },
];

/**
 * `components/customer/CustomerProfile.tsx` — HO-P4 §11.2.9, US-ACC-10/11, US-BIL-03. The one
 * customer profile layout, shared by `/staff/customers?customer=…` and `/staff/customers/[id]`:
 * identity, the "New order" action, an optional row of key figures, the Orders / Billing tabs, the
 * erase panel (Administrators) and the duplicates link. Like every `components/customer` file it
 * imports no hooks: the page loads the data and the panels and passes them in. Not built, because
 * the API has no data for them (BG-15, BG-19): Subscriptions and Notes tabs, "Send password reset",
 * lifetime spend, order count and "Customer since".
 */
export function CustomerProfile({
  customer,
  headingLevel = 1,
  messagesLink,
  figures,
  ordersPanel,
  billingPanel,
  erasePanel,
}: {
  customer: StaffCustomer;
  headingLevel?: 1 | 2;
  messagesLink?: ReactNode;
  /** A row of `KpiTile`s built from server figures; omitted when there are none. */
  figures?: ReactNode;
  ordersPanel: ReactNode;
  billingPanel: ReactNode;
  erasePanel?: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTab>('orders');

  return (
    <div className="flex flex-col gap-5">
      {/* Only the identity block is a card here: the panels below bring their own, and nesting
          them in a second padded card leaves too little width for them at 360 px. */}
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <CustomerDetail customer={customer} headingLevel={headingLevel} />

        <div className="flex flex-wrap items-center gap-2">
          <ActionLink
            href={`/staff/pos?customerId=${encodeURIComponent(customer.id)}`}
            variant="primary"
          >
            New order
          </ActionLink>
          {messagesLink}
        </div>

        {figures}
      </div>

      <div className="flex flex-col gap-4">
        <UnderlineTabs
          mode="state"
          label="Customer details"
          items={TABS}
          value={tab}
          onChange={(key) => setTab(key as ProfileTab)}
        />
        {/* The panels belong to other areas and a few of their controls are wider than a 360 px
            screen leaves them; the region scrolls on its own (keyboard-focusable) instead of
            widening the page (UI-1). */}
        <div
          role="tabpanel"
          aria-label={tab === 'orders' ? 'Orders' : 'Billing'}
          tabIndex={0}
          className="min-w-0 overflow-x-auto"
        >
          {tab === 'orders' ? ordersPanel : billingPanel}
        </div>
      </div>

      {erasePanel && (
        <div
          role="region"
          aria-label="Personal data"
          tabIndex={0}
          className="min-w-0 overflow-x-auto"
        >
          {erasePanel}
        </div>
      )}

      <p className="text-sm text-ink-muted">
        Duplicate record?{' '}
        <Link
          href="/staff/customers/duplicates"
          className="font-semibold text-accent-ink underline"
        >
          Review duplicates
        </Link>
      </p>
    </div>
  );
}
