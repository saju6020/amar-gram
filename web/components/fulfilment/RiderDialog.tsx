'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { TextField } from '@/components/billing/Fields';
import { OrderDialog } from '@/components/orders/OrderDialog';
import { submitOrderingForm } from '@/lib/api/errors';
import type { Rider } from '@/lib/api/staff-orders';
import { useCreateRider, useUpdateRider } from '@/lib/hooks/useStaffOrders';

/**
 * `components/fulfilment/RiderDialog.tsx` — HO-P5 §11.3.10 (BG-5, OQ-9). Add or edit one in-house rider: a
 * name, an optional mobile number and whether the rider is active. `RiderNameAlreadyExists` and an
 * unusable mobile number appear under their fields. Turning an active rider off asks first (UI-3): the
 * form gives way to a sentence saying exactly what changes, with Back and a confirming button. A rider is
 * deactivated, never deleted, because the orders it carried point at it.
 */
interface RiderValues {
  name: string;
  mobileNumber: string;
  isActive: boolean;
}

const BLANK: RiderValues = { name: '', mobileNumber: '', isActive: true };

export function RiderDialog({
  open,
  onOpenChange,
  rider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rider being edited, or `null` for a new one. */
  rider: Rider | null;
}) {
  const create = useCreateRider();
  const update = useUpdateRider();
  const [confirming, setConfirming] = useState<RiderValues | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<RiderValues>({ defaultValues: BLANK });

  useEffect(() => {
    if (open) reset(rider ? { name: rider.name, mobileNumber: rider.mobileNumber ?? '', isActive: rider.isActive } : BLANK);
    else setConfirming(null);
  }, [open, rider, reset]);

  const pending = create.isPending || update.isPending;

  async function save(values: RiderValues) {
    const input = { name: values.name.trim(), mobileNumber: values.mobileNumber.trim() || null, isActive: values.isActive };
    const done = await submitOrderingForm(
      async () => {
        if (rider) await update.mutateAsync({ riderId: rider.id, rider: input });
        else await create.mutateAsync(input);
        return true as const;
      },
      setError,
      { knownFields: ['name', 'mobileNumber', 'isActive'], fieldMap: { Name: 'name', MobileNumber: 'mobileNumber' } },
    );
    if (done) onOpenChange(false);
    else setConfirming(null);
  }

  const submit = handleSubmit(async (values) => {
    if (!values.name.trim()) {
      setError('name', { message: 'Enter the rider’s name.' });
      return;
    }
    // Turning an active rider off is the one change that takes someone out of the dispatch list: say so first.
    if (rider?.isActive && !values.isActive && !confirming) {
      setConfirming(values);
      return;
    }
    await save(values);
  });

  return (
    <OrderDialog
      open={open}
      onOpenChange={onOpenChange}
      title={rider ? `Edit ${rider.name}` : 'Add a rider'}
      description={
        rider
          ? 'Changes apply to the next dispatch. Orders already sent with this rider keep their rider.'
          : 'Riders are the people you can choose when you dispatch a delivery order.'
      }
      onSubmit={submit}
      submitLabel={confirming ? 'Deactivate rider' : rider ? 'Save rider' : 'Add rider'}
      pending={pending}
      rootError={errors.root?.message}
      variant={confirming ? 'destructive' : 'primary'}
      confirmation={
        confirming
          ? `${rider?.name ?? 'This rider'} will no longer be offered when you dispatch an order. Orders already sent with them are not changed, and you can turn them back on later.`
          : undefined
      }
      onBack={() => setConfirming(null)}
    >
      <TextField id="rider-name" label="Name" required maxLength={100} error={errors.name?.message} {...register('name')} />
      <TextField
        id="rider-mobile"
        label="Mobile number"
        type="tel"
        inputMode="tel"
        maxLength={30}
        hint="Optional. A Bangladesh mobile number, like 01712 345678."
        error={errors.mobileNumber?.message}
        {...register('mobileNumber')}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" {...register('isActive')} />
        Active (offered when dispatching)
      </label>
    </OrderDialog>
  );
}
