'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/billing/Fields';
import { ApiNotFoundError } from '@/lib/api/client';
import { hasOrderingCode, submitOrderingForm } from '@/lib/api/errors';
import { useDispatchCouriers, useDispatchOrder, useCanManageRiders, useRecordTracking, useRiders } from '@/lib/hooks/useStaffOrders';
import { cn } from '@/lib/utils';
import { OrderDialog } from './OrderDialog';

/**
 * `components/orders/DispatchDialog.tsx` + `TrackingDialog` — HO-ORD-002 §11.8, US-ORD-11; HO-P5 §11.3.9
 * (BG-5). Dispatch goes with a **courier** (tracking optional, and it can be entered later from the order)
 * or an in-house **rider** (no tracking), chosen in the "Send with" radiogroup; the request carries exactly
 * one of the two ids. With no active rider the Rider option is disabled and says "No riders set up", and a
 * holder of `Riders.Manage` (presentation only: the server decides) gets a "Manage riders" link. A refusal
 * that is about stock (`BatchRecalled`, `BatchExpired`, `OrderNotFullyAllocated`, BR-14) shows the server's
 * message with a **Reallocate** shortcut that closes this dialog and opens the reallocation one.
 */
interface DispatchValues {
  courierId: string;
  riderId: string;
  trackingNumber: string;
}

type SendWith = 'courier' | 'rider';

const STOCK_CODES = ['BatchRecalled', 'BatchExpired', 'OrderNotFullyAllocated'];

export function DispatchDialog({
  orderId,
  open,
  onOpenChange,
  onReallocate,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReallocate: () => void;
}) {
  const couriers = useDispatchCouriers(open);
  const riders = useRiders(true, open);
  const dispatch = useDispatchOrder(orderId);
  const canManageRiders = useCanManageRiders();
  const [stockRefusal, setStockRefusal] = useState(false);
  const [sendWith, setSendWith] = useState<SendWith>('courier');
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<DispatchValues>({ defaultValues: { courierId: '', riderId: '', trackingNumber: '' } });

  useEffect(() => {
    if (!open) {
      reset();
      setStockRefusal(false);
      setSendWith('courier');
    }
  }, [open, reset]);

  const activeRiders = riders.data ?? [];
  const noRiders = riders.isSuccess && activeRiders.length === 0;
  const riderUnavailable = noRiders || riders.isError;

  const submit = handleSubmit(async (values) => {
    const byRider = sendWith === 'rider';
    if (byRider ? !values.riderId : !values.courierId) {
      setError(byRider ? 'riderId' : 'courierId', { message: byRider ? 'Choose a rider.' : 'Choose a courier.' });
      return;
    }
    setStockRefusal(false);
    const done = await submitOrderingForm(
      async () => {
        try {
          await dispatch.mutateAsync(
            byRider
              ? { target: { riderId: values.riderId } }
              : { target: { courierId: values.courierId }, trackingNumber: values.trackingNumber.trim() || undefined },
          );
        } catch (error) {
          if (error instanceof ApiNotFoundError) {
            // A 404 carries no body here, and the server uses it for an unknown order as well as for `RiderNotFound` /
            // `CourierNotFound` (OrderingResults.cs:15-21). Read the list again: if the one chosen is no longer on it, the
            // person is told that; if it still is, the order is what went missing.
            const chosen = byRider ? values.riderId : values.courierId;
            // `refetch()` does not throw: a failed re-read says nothing about the order, so it keeps the rider/courier message.
            const reread = byRider ? await riders.refetch() : await couriers.refetch();
            if (!reread.isError && reread.data?.some((entry) => entry.id === chosen)) {
              setError('root', { message: 'This order could not be found. It may have moved to another branch.' });
            } else {
              setError(byRider ? 'riderId' : 'courierId', {
                message: byRider ? 'That rider is not available. Choose another.' : 'That courier is not available. Choose another.',
              });
            }
            return false as const;
          }
          if (STOCK_CODES.some((code) => hasOrderingCode(error, code))) setStockRefusal(true);
          throw error;
        }
        return true as const;
      },
      setError,
      {
        knownFields: ['courierId', 'riderId', 'trackingNumber'],
        fieldMap: { CourierId: 'courierId', RiderId: 'riderId', TrackingNumber: 'trackingNumber' },
      },
    );
    if (done) onOpenChange(false);
  });

  const choice = (value: SendWith, label: string, disabled = false) => (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border px-3 text-center text-sm font-semibold text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
        sendWith === value ? 'border-2 border-leaf bg-leaf-soft' : 'border-border bg-surface',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name="dispatch-send-with"
        className="sr-only"
        value={value}
        checked={sendWith === value}
        disabled={disabled}
        aria-describedby={disabled ? 'dispatch-no-riders' : undefined}
        onChange={() => {
          setSendWith(value);
          clearErrors();
        }}
      />
      {label}
    </label>
  );

  return (
    <OrderDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dispatch order"
      description={
        sendWith === 'rider'
          ? 'The order moves to Dispatched, with the rider you choose. The customer sees that our own rider is bringing it.'
          : 'The order moves to Dispatched and the customer can see the courier and tracking number.'
      }
      onSubmit={submit}
      submitLabel="Dispatch"
      pending={dispatch.isPending}
      rootError={errors.root?.message}
    >
      <div className="flex flex-col gap-1.5">
        <span id="dispatch-send-with" className="text-[13px] font-semibold text-ink-muted">Send with</span>
        <div role="radiogroup" aria-labelledby="dispatch-send-with" className="grid grid-cols-2 gap-2">
          {choice('courier', 'Courier')}
          {choice('rider', 'Rider', riderUnavailable)}
        </div>
        {riderUnavailable && (
          <p id="dispatch-no-riders" className="m-0 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            <span>{noRiders ? 'No riders set up' : 'Riders couldn’t be loaded.'}</span>
            {noRiders && canManageRiders && (
              <Link href="/staff/fulfilment/riders" className="font-semibold text-accent-ink underline">
                Manage riders
              </Link>
            )}
          </p>
        )}
      </div>
      {sendWith === 'courier' ? (
        <>
          <SelectField id="dispatch-courier" label="Which courier" required error={errors.courierId?.message} {...register('courierId')}>
            <option value="">Choose a courier</option>
            {(couriers.data ?? []).map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="dispatch-tracking"
            label="Tracking number"
            maxLength={100}
            hint="Optional. If the courier hasn’t given you one yet, leave it empty and enter it later from the order."
            error={errors.trackingNumber?.message}
            {...register('trackingNumber')}
          />
        </>
      ) : (
        <SelectField id="dispatch-rider" label="Which rider" required error={errors.riderId?.message} {...register('riderId')}>
          <option value="">Choose a rider</option>
          {activeRiders.map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name}
            </option>
          ))}
        </SelectField>
      )}
      {stockRefusal && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-border p-3 text-sm">
          <span>Move the affected line to another batch, then dispatch again.</span>
          <Button variant="secondary" size="sm" onClick={onReallocate}>
            Reallocate a line
          </Button>
        </div>
      )}
    </OrderDialog>
  );
}

export function TrackingDialog({
  orderId,
  open,
  onOpenChange,
  current,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string | null;
}) {
  const record = useRecordTracking(orderId);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<{ trackingNumber: string }>({ defaultValues: { trackingNumber: current ?? '' } });

  useEffect(() => {
    if (open) reset({ trackingNumber: current ?? '' });
  }, [open, current, reset]);

  const submit = handleSubmit(async (values) => {
    if (!values.trackingNumber.trim()) {
      setError('trackingNumber', { message: 'Enter the tracking number.' });
      return;
    }
    const done = await submitOrderingForm(
      async () => {
        await record.mutateAsync(values.trackingNumber.trim());
        return true as const;
      },
      setError,
      { knownFields: ['trackingNumber'] },
    );
    if (done) onOpenChange(false);
  });

  return (
    <OrderDialog
      open={open}
      onOpenChange={onOpenChange}
      title={current ? 'Change tracking number' : 'Enter tracking number'}
      description="The customer sees this number, and a tracking link when the courier has one."
      onSubmit={submit}
      submitLabel="Save tracking number"
      pending={record.isPending}
      rootError={errors.root?.message}
    >
      <TextField
        id="tracking-number"
        label="Tracking number"
        required
        maxLength={100}
        error={errors.trackingNumber?.message}
        {...register('trackingNumber')}
      />
    </OrderDialog>
  );
}
