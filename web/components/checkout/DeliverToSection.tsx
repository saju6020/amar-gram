'use client';

import { useState } from 'react';
import { House, Plus, Store, Truck, TriangleAlert } from 'lucide-react';
import { AddressForm } from '@/components/account/AddressForm';
import { bannerWarnClass } from '@/components/hearth/card';
import { pillInputClass } from '@/components/hearth/fields';
import { OptionCard } from '@/components/hearth/OptionCard';
import { Button } from '@/components/ui/button';
import type { DeliveryAddress, DeliveryAddressRequest } from '@/lib/api/account';
import type { FulfilmentChoice, PickupBranch, QuoteDelivery } from '@/lib/api/checkout';
import { describeBlockingReason } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { CheckoutSection } from './CheckoutSection';

const SUB_HEADING = 'm-0 text-base font-bold text-ink';

/**
 * `components/checkout/DeliverToSection.tsx` — section 1 of the single-page checkout (HO-P3 S3, ADR-FE-175;
 * HO-ORD-002 US-ORD-03/06). **Delivery** (saved addresses from HO-ACC-002 as a radio group of cards;
 * *Add a new address* opens its form inline and returns the id) or **Pickup** (branches with address and
 * phone). When the quote says the address is outside every zone, or the shop's delivery tax is not
 * configured, delivery is explained in words and pickup stays selectable. Everything shown here is the
 * quote's.
 */
export function DeliverToSection({
  fulfilment,
  onFulfilment,
  addresses,
  addressId,
  onAddress,
  onAddAddress,
  pickupBranches,
  pickupBranchId,
  onPickupBranch,
  delivery,
  deliveryTaxUnavailable,
  districtName,
  recipientName,
  recipientPhone,
  onRecipient,
  error,
}: {
  fulfilment: FulfilmentChoice;
  onFulfilment: (value: FulfilmentChoice) => void;
  addresses: DeliveryAddress[];
  addressId: string | undefined;
  onAddress: (id: string) => void;
  onAddAddress: (values: DeliveryAddressRequest) => Promise<unknown>;
  pickupBranches: PickupBranch[];
  pickupBranchId: string | undefined;
  onPickupBranch: (id: string) => void;
  delivery: QuoteDelivery | undefined;
  deliveryTaxUnavailable: boolean;
  districtName: string | null;
  recipientName: string;
  recipientPhone: string;
  onRecipient: (patch: { name?: string; phone?: string }) => void;
  error: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const outside =
    delivery?.available === false && delivery.unavailableReason === 'AddressOutsideServedZones';

  return (
    <CheckoutSection id="co-deliver" step={1} title="Deliver to">
      <div
        role="radiogroup"
        aria-label="How would you like to get your order?"
        className="grid gap-3 sm:grid-cols-2"
      >
        <OptionCard
          name="fulfilment"
          checked={fulfilment === 'Delivery'}
          onChange={() => onFulfilment('Delivery')}
          icon={<Truck size={20} aria-hidden="true" />}
          title="Delivery"
        >
          We bring it to your door.
        </OptionCard>
        <OptionCard
          name="fulfilment"
          checked={fulfilment === 'Pickup'}
          onChange={() => onFulfilment('Pickup')}
          icon={<Store size={22} aria-hidden="true" />}
          title="Collect from a branch"
        >
          Pick it up when it is ready.
        </OptionCard>
      </div>

      {fulfilment === 'Delivery' && deliveryTaxUnavailable && (
        <p role="status" className={cn(bannerWarnClass, 'm-0 font-semibold')}>
          <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
          {describeBlockingReason('DeliveryTaxNotConfigured')}
        </p>
      )}
      {outside && (
        <p role="status" className={cn(bannerWarnClass, 'm-0 font-semibold')}>
          <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
          {districtName
            ? `We don't deliver to ${districtName} yet. You can collect your order instead.`
            : "We don't deliver to that address yet. You can collect your order instead."}
        </p>
      )}

      {fulfilment === 'Delivery' ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 id="co-address-label" className={SUB_HEADING}>
            Delivery address
          </h3>
          {addresses.length === 0 && (
            <p className="m-0 text-sm text-ink-muted">You haven&rsquo;t saved an address yet.</p>
          )}
          <div
            role="radiogroup"
            aria-labelledby="co-address-label"
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            {addresses.map((address) => (
              <OptionCard
                key={address.id}
                name="address"
                checked={addressId === address.id}
                onChange={() => onAddress(address.id)}
                icon={<House size={22} aria-hidden="true" />}
                title={`${address.label}${address.isDefault ? ' (default)' : ''}`}
              >
                {[address.line1, address.line2, address.city, address.district, address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </OptionCard>
            ))}
          </div>
          <div>
            <Button variant="pillSecondary" size="pillMd" onClick={() => setAdding(true)}>
              <Plus size={14} aria-hidden="true" />
              Add a new address
            </Button>
          </div>
          <AddressForm
            open={adding}
            onOpenChange={setAdding}
            onSubmit={async (values) => {
              const result = (await onAddAddress(values)) as { addressId?: string } | undefined;
              if (result?.addressId) onAddress(result.addressId);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 id="co-branch-label" className={SUB_HEADING}>
            Collect from
          </h3>
          {pickupBranches.length === 0 && (
            <p className="m-0 text-sm text-ink-muted">Loading branches…</p>
          )}
          <div
            role="radiogroup"
            aria-labelledby="co-branch-label"
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            {pickupBranches.map((branch) => (
              <OptionCard
                key={branch.id}
                name="pickup-branch"
                checked={pickupBranchId === branch.id}
                onChange={() => onPickupBranch(branch.id)}
                icon={<Store size={22} aria-hidden="true" />}
                title={branch.name}
              >
                {[branch.address, branch.phone].filter(Boolean).join(' · ')}
              </OptionCard>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t-[1.5px] border-dashed border-border-strong pt-3.5">
        <h3 id="recipient-heading" className={SUB_HEADING}>
          {fulfilment === 'Pickup' ? "Who's collecting" : "Who's receiving"}
        </h3>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recipient-name" className="text-[13px] font-semibold text-ink">
              Recipient name
            </label>
            <input
              id="recipient-name"
              className={pillInputClass}
              value={recipientName}
              autoComplete="name"
              onChange={(event) => onRecipient({ name: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recipient-phone" className="text-[13px] font-semibold text-ink">
              Recipient phone
            </label>
            <input
              id="recipient-phone"
              className={pillInputClass}
              value={recipientPhone}
              inputMode="tel"
              autoComplete="tel"
              onChange={(event) => onRecipient({ phone: event.target.value })}
            />
          </div>
        </div>
        <p className="m-0 text-xs text-ink-muted">
          Filled from your profile. Change them if someone else is{' '}
          {fulfilment === 'Pickup' ? 'collecting' : 'receiving it'}.
        </p>
      </div>

      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </CheckoutSection>
  );
}
