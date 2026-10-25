'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { describeApiError } from '@/lib/api/errors';
import type { DeliveryAddress } from '@/lib/api/account';
import { cn } from '@/lib/utils';

/**
 * `components/account/AddressCard.tsx` — US-ACC-06, UI-3 (removal confirms, naming the label), restyled to
 * docs/design/store/Profile.dc.html (HO-P3 S4): the default address has a leaf border and a "Default" leaf pill;
 * the others offer "Make default".
 *
 * ARCH gate HIGH 3 (first pass) — takes `onRemove`/`onSetDefault`/`isSettingDefault` as props
 * instead of calling `useRemoveDeliveryAddress()`/`useSetDefaultDeliveryAddress()` itself; the
 * page (`app/(portal)/portal/account/addresses/page.tsx`) owns both mutations (one instance each,
 * shared across every card in the list) and threads them down through `AddressList`.
 */
export interface AddressCardProps {
  address: DeliveryAddress;
  onEdit: () => void;
  onRemove: (addressId: string) => Promise<void>;
  onSetDefault: (addressId: string) => void;
  isSettingDefault: boolean;
}

export function AddressCard({
  address,
  onEdit,
  onRemove,
  onSetDefault,
  isSettingDefault,
}: AddressCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove() {
    setRemoveError(null);
    try {
      await onRemove(address.id);
      setConfirmOpen(false);
    } catch (error) {
      // DefaultAddressCannotBeRemoved surfaces here, as the server's own reason.
      setRemoveError(describeApiError(error));
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[18px] bg-surface p-[18px]',
        address.isDefault ? 'border-2 border-leaf' : 'border-[1.5px] border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 font-semibold text-ink">{address.label}</p>
        {address.isDefault && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-leaf-soft px-2.5 py-0.5 text-[13px] font-semibold text-leaf-ink">
            <Check size={12} aria-hidden="true" />
            Default
          </span>
        )}
      </div>
      <p className="m-0 text-ink-muted [overflow-wrap:anywhere]">
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.district}
        {address.postalCode ? ` ${address.postalCode}` : ''}
      </p>
      {address.deliveryInstructions && (
        <p className="m-0 text-sm text-ink-muted [overflow-wrap:anywhere]">
          {address.deliveryInstructions}
        </p>
      )}
      {removeError && (
        <p role="alert" className="m-0 text-xs font-semibold text-danger-ink">
          {removeError}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button variant="pillSecondary" size="pillMd" onClick={onEdit}>
          Edit
        </Button>
        {!address.isDefault && (
          <Button
            variant="pillSecondary"
            size="pillMd"
            onClick={() => onSetDefault(address.id)}
            disabled={isSettingDefault}
          >
            Make default
          </Button>
        )}
        <Button
          variant="ghost"
          size="pillMd"
          className="text-danger-ink"
          onClick={() => setConfirmOpen(true)}
        >
          Remove
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove "${address.label}"?`}
        consequence={`This removes the "${address.label}" address from your account. This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
      />
    </div>
  );
}
