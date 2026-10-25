'use client';

import Link from 'next/link';
import { useDeliveryAddresses } from '@/lib/hooks/useAccount';

const ADDRESSES = '/portal/account/addresses';

/**
 * `components/portal/dashboard/DefaultAddressCard.tsx` — the overview's "Default address" card
 * (docs/design/store/Account.dc.html, HO-P3 S4): the default address, "N saved addresses" and a link to manage them.
 * A failed read says so and keeps the link; it never shows "no address".
 */
export function DefaultAddressCard() {
  const query = useDeliveryAddresses();
  const addresses = query.data?.addresses;
  const chosen = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const count = addresses?.length ?? 0;

  return (
    <section
      aria-labelledby="acc-addr"
      data-testid="default-address"
      className="flex min-w-0 flex-col gap-2 rounded-card border-[1.5px] border-border bg-surface p-5 sm:p-6"
    >
      <h2 id="acc-addr" className="m-0 text-lg font-semibold text-ink">
        Default address
      </h2>
      {query.isPending ? (
        <p role="status" className="m-0 text-ink-muted">
          Loading your address…
        </p>
      ) : query.isError || !addresses ? (
        <p role="status" className="m-0 text-ink-muted">
          We couldn’t load your addresses just now.
        </p>
      ) : chosen ? (
        <>
          <p className="m-0 text-ink-muted [overflow-wrap:anywhere]">
            {[chosen.line1, chosen.line2, chosen.city, chosen.district].filter(Boolean).join(', ')}
          </p>
          <p className="m-0 text-[15px] text-ink-muted">
            {`${count} saved ${count === 1 ? 'address' : 'addresses'}`}
          </p>
        </>
      ) : (
        <p className="m-0 text-ink-muted">You have no saved address yet.</p>
      )}
      <Link
        href={ADDRESSES}
        className="mt-auto inline-flex min-h-11 items-center font-semibold text-accent-ink"
      >
        {chosen || query.isError ? 'Manage addresses' : 'Add an address'}
      </Link>
    </section>
  );
}
