'use client';

import { Button } from '@/components/ui/button';
import { usePosCustomerLookup } from '@/lib/hooks/usePos';
import type { PosCustomer } from './types';

/**
 * `components/pos/PosCustomerPanel.tsx` — HO-ORD-002 §11.11, OQ-5, Amended (2) / ADR-216; HO-P4 S2: opened from the ticket's customer chip.
 * HO-P5 BG-8: the buyer is optional — the **name and mobile number** are given together (the person is found by mobile or
 * created) or both left empty for an anonymous walk-in sale; the screen blocks one without the other. **Find an
 * existing customer** looks the mobile up and attaches the match. Errors from the server for either field arrive on the screen's message.
 */
export function PosCustomerPanel({
  customer,
  onChange,
  errors,
}: {
  customer: PosCustomer;
  onChange: (next: PosCustomer) => void;
  errors: { name?: string; mobile?: string };
}) {
  const lookup = usePosCustomerLookup();
  const field = 'w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  return (
    <div role="group" aria-label="Customer" className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface-page p-3">
      <p className="text-sm text-ink-muted">Optional. Give the name and the mobile number together, or leave both empty for a walk-in sale.</p>
      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pos-cust-name" className="text-sm font-semibold">Customer name</label>
          <input id="pos-cust-name" className={field} value={customer.name} maxLength={200} aria-invalid={!!errors.name} onChange={(e) => onChange({ ...customer, name: e.target.value, customerId: null })} />
          {errors.name && <p role="alert" className="text-xs font-semibold text-danger-ink">{errors.name}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pos-cust-mobile" className="text-sm font-semibold">Mobile number</label>
          <input id="pos-cust-mobile" className={field} value={customer.mobile} inputMode="tel" maxLength={20} aria-invalid={!!errors.mobile} onChange={(e) => onChange({ ...customer, mobile: e.target.value, customerId: null })} />
          {errors.mobile && <p role="alert" className="text-xs font-semibold text-danger-ink">{errors.mobile}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={!customer.mobile.trim() || lookup.isPending} onClick={() => lookup.mutate(customer.mobile)}>
          Find an existing customer
        </Button>
        {customer.customerId && <span role="status" className="text-sm font-semibold text-accent-ink">Attached: {customer.name}</span>}
      </div>
      {lookup.isSuccess && lookup.data.length === 0 && <p role="status" className="text-sm text-ink-muted">No customer has that number. The sale will create one.</p>}
      {lookup.isError && <p role="alert" className="text-sm font-semibold text-danger-ink">We couldn’t search just now. Try again.</p>}
      {lookup.data && lookup.data.length > 0 && (
        <ul aria-label="Matching customers" className="m-0 flex list-none flex-col gap-1 p-0">
          {lookup.data.map((found) => (
            <li key={found.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{found.fullName} · {found.mobileNumber}</span>
              <Button size="sm" onClick={() => { onChange({ name: found.fullName, mobile: found.mobileNumber ?? customer.mobile, customerId: found.id }); lookup.reset(); }}>
                Attach<span className="sr-only"> {found.fullName}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
