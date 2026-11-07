'use client';

import { useEffect, useRef, useState } from 'react';
import { House, Plus, Store, Truck } from 'lucide-react';
import { AddressForm } from '@/components/account/AddressForm';
import { OptionCard } from '@/components/hearth/OptionCard';
import { Button } from '@/components/ui/button';
import type { DeliveryAddress, DeliveryAddressRequest } from '@/lib/api/account';
import type { PublicBranch } from '@/lib/api/admin-branches';
import type { SubscriptionFulfilment } from '@/lib/api/subscriptions';
import { subscriptionFulfilmentLabel } from '@/lib/subscriptions/labels';
import { FieldError } from './FieldError';

const SUB_HEADING = 'm-0 text-base font-bold text-ink';

export interface FulfilmentFieldsProps {
  idPrefix: string;
  fulfilment: SubscriptionFulfilment;
  onFulfilment: (value: SubscriptionFulfilment) => void;
  addresses: DeliveryAddress[] | undefined;
  addressesFailed: boolean;
  addressId: string | null;
  onAddress: (id: string) => void;
  /** Saves a new address through Accounts and resolves with its id (ADR-FE-196). */
  onAddAddress: (values: DeliveryAddressRequest) => Promise<{ addressId: string } | undefined>;
  branches: PublicBranch[] | undefined;
  branchId: string | null;
  onBranch: (id: string) => void;
  addressError?: string;
  branchError?: string;
  /** Moves keyboard focus to the address choice when the field opens (the "address was removed" shortcut). */
  focusAddress?: boolean;
}

/**
 * "Delivery or pickup" (HO-P6 §11.2.3): two radio cards, then either the address book from Accounts with "Add a new address"
 * inline (the shared `AddressForm`, as checkout does, ADR-FE-196) or the outlets from the public branch list (OQ-7).
 */
export function FulfilmentFields({
  idPrefix,
  fulfilment,
  onFulfilment,
  addresses,
  addressesFailed,
  addressId,
  onAddress,
  onAddAddress,
  branches,
  branchId,
  onBranch,
  addressError,
  branchError,
  focusAddress,
}: FulfilmentFieldsProps) {
  const [adding, setAdding] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusAddress) {
      groupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    }
  }, [focusAddress]);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Delivery or pickup"
        className="grid gap-3 sm:grid-cols-2"
      >
        {(['Delivery', 'Pickup'] as const).map((value) => (
          <OptionCard
            key={value}
            name={`${idPrefix}-fulfilment`}
            checked={fulfilment === value}
            onChange={() => onFulfilment(value)}
            icon={value === 'Delivery' ? <Truck size={20} aria-hidden="true" /> : <Store size={22} aria-hidden="true" />}
            title={subscriptionFulfilmentLabel(value)}
          >
            {value === 'Delivery' ? 'We bring each order to your door.' : 'Pick each order up when it is ready.'}
          </OptionCard>
        ))}
      </div>

      {fulfilment === 'Delivery' ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 id={`${idPrefix}-address-label`} className={SUB_HEADING}>
            Delivery address
          </h3>
          {addressesFailed && (
            <p role="status" className="m-0 text-sm text-ink-muted">
              We couldn&rsquo;t load your addresses just now. You can add one below.
            </p>
          )}
          {addresses && addresses.length === 0 && (
            <p className="m-0 text-sm text-ink-muted">You haven&rsquo;t saved an address yet.</p>
          )}
          <div
            ref={groupRef}
            role="radiogroup"
            aria-labelledby={`${idPrefix}-address-label`}
            aria-describedby={addressError ? `${idPrefix}-address-error` : undefined}
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            {(addresses ?? []).map((address) => (
              <OptionCard
                key={address.id}
                name={`${idPrefix}-address`}
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
          <FieldError id={`${idPrefix}-address-error`}>{addressError}</FieldError>
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
              const created = await onAddAddress(values);
              if (created?.addressId) onAddress(created.addressId);
              // AddressForm only closes itself for a returned value; this dialog is closed here, as checkout's is.
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 id={`${idPrefix}-branch-label`} className={SUB_HEADING}>
            Collect from
          </h3>
          {!branches && (
            <p role="status" className="m-0 text-sm text-ink-muted">
              Loading outlets…
            </p>
          )}
          {branches && branches.length === 0 && (
            <p className="m-0 text-sm text-ink-muted">No outlet is open for collection right now.</p>
          )}
          <div
            role="radiogroup"
            aria-labelledby={`${idPrefix}-branch-label`}
            aria-describedby={branchError ? `${idPrefix}-branch-error` : undefined}
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            {(branches ?? []).map((branch) => (
              <OptionCard
                key={branch.id}
                name={`${idPrefix}-branch`}
                checked={branchId === branch.id}
                onChange={() => onBranch(branch.id)}
                icon={<Store size={22} aria-hidden="true" />}
                title={branch.name}
              >
                {[branch.addressLine, branch.phoneNumber].filter(Boolean).join(' · ')}
              </OptionCard>
            ))}
          </div>
          <FieldError id={`${idPrefix}-branch-error`}>{branchError}</FieldError>
        </div>
      )}
    </div>
  );
}
