'use client';

import { useEffect, useState } from 'react';
import { Banknote, Landmark, Store, TriangleAlert } from 'lucide-react';
import { OptionCard } from '@/components/hearth/OptionCard';
import { bannerWarnClass } from '@/components/hearth/card';
import { useAddDeliveryAddress } from '@/lib/hooks/useAccountMutations';
import { useDeliveryAddresses } from '@/lib/hooks/useAccount';
import {
  useOutletContacts,
  useSubscriptionPaymentMethods,
} from '@/lib/hooks/useSubscriptions';
import type { SubscriptionOptions, SubscriptionPaymentMethod } from '@/lib/api/subscriptions';
import {
  PAYMENT_HEADING,
  PAY_CHECKING,
  PAY_CHECK_FAILED,
  PAY_CHOOSE_ADDRESS,
  PAY_CHOOSE_OUTLET,
  howPayingWorks,
  paymentSwapNote,
} from '@/lib/subscriptions/copy';
import type { SubscriptionFieldErrors } from '@/lib/subscriptions/errors';
import { intervalLabel, subscriptionPaymentMethodLabel } from '@/lib/subscriptions/labels';
import { cn } from '@/lib/utils';
import { FieldError } from './FieldError';
import { FulfilmentFields } from './FulfilmentFields';
import { QuantityField } from './QuantityField';
import type { TermsDraft } from './termsDraft';

const SECTION_HEADING = 'm-0 font-display text-lg font-semibold text-ink';

const METHOD_ICONS: Record<SubscriptionPaymentMethod, typeof Banknote> = {
  CashOnDelivery: Banknote,
  BankTransfer: Landmark,
  PayAtPickup: Store,
};

export interface TermsFieldsProps {
  idPrefix: string;
  skuId: string;
  options: Pick<SubscriptionOptions, 'allowedIntervalWeeks' | 'maxQuantity'>;
  draft: TermsDraft;
  /** Must be stable (a `useCallback` over a state setter): the fields call it from effects. */
  onChange: (patch: Partial<TermsDraft>) => void;
  errors: SubscriptionFieldErrors;
  /** Preselect the default address and the first available payment method (the Subscribe form). */
  preselect?: boolean;
  focusAddress?: boolean;
}

/**
 * The terms controls the Subscribe form and the change dialog share (HO-P6 §11.2.3, §11.2.6): quantity, how often,
 * delivery or pickup, and how the customer will pay for each order. Payment methods are read from Orders (C2) only once an
 * address or outlet is chosen; an unavailable one stays in the list, disabled, with the reason as text under it.
 * Nothing here is a card field: payment is a stated intention (ADR-FE-113).
 */
export function TermsFields({
  idPrefix,
  skuId,
  options,
  draft,
  onChange,
  errors,
  preselect,
  focusAddress,
}: TermsFieldsProps) {
  const addressBook = useDeliveryAddresses();
  const addAddress = useAddDeliveryAddress();
  const outlets = useOutletContacts();
  const addressOrBranchId = draft.fulfilment === 'Delivery' ? draft.addressId : draft.branchId;
  const methods = useSubscriptionPaymentMethods({
    skuId,
    quantity: draft.quantity,
    fulfilment: draft.fulfilment,
    addressOrBranchId,
  });

  const addresses = addressBook.data?.addresses;
  useEffect(() => {
    if (!preselect || draft.fulfilment !== 'Delivery' || draft.addressId || !addresses?.length) return;
    onChange({ addressId: (addresses.find((a) => a.isDefault) ?? addresses[0])!.id });
  }, [preselect, draft.fulfilment, draft.addressId, addresses, onChange]);

  const methodList = methods.data;
  const [swapNote, setSwapNote] = useState('');
  useEffect(() => {
    if (!preselect || !methodList) return;
    // Nothing chosen yet, or the chosen method is not offered for this address and quantity: take the first one that is.
    const chosen = methodList.find((m) => m.method === draft.paymentMethod);
    if (chosen?.isAvailable) return;
    const first = methodList.find((m) => m.isAvailable);
    if (first) {
      onChange({ paymentMethod: first.method });
      // Only a swap of a method the customer had is announced; the first choice on arrival is not.
      if (draft.paymentMethod && chosen) {
        setSwapNote(
          paymentSwapNote(
            subscriptionPaymentMethodLabel(draft.paymentMethod),
            subscriptionPaymentMethodLabel(first.method),
          ),
        );
      }
    } else if (draft.paymentMethod && chosen) onChange({ paymentMethod: null });
  }, [preselect, draft.paymentMethod, methodList, onChange]);

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby={`${idPrefix}-qty-h`} className="flex flex-col gap-3">
        <h2 id={`${idPrefix}-qty-h`} className={SECTION_HEADING}>
          Per delivery
        </h2>
        <QuantityField
          id={`${idPrefix}-quantity`}
          value={draft.quantity}
          max={options.maxQuantity}
          onChange={(quantity) => onChange({ quantity })}
          error={errors.quantity}
        />
      </section>

      <section aria-labelledby={`${idPrefix}-interval-h`} className="flex flex-col gap-3">
        <h2 id={`${idPrefix}-interval-h`} className={SECTION_HEADING}>
          How often
        </h2>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-interval-h`}
          aria-describedby={errors.intervalWeeks ? `${idPrefix}-interval-error` : undefined}
          className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
        >
          {options.allowedIntervalWeeks.map((weeks) => (
            <OptionCard
              key={weeks}
              name={`${idPrefix}-interval`}
              checked={draft.intervalWeeks === weeks}
              onChange={() => onChange({ intervalWeeks: weeks })}
              title={intervalLabel(weeks)}
            />
          ))}
        </div>
        <FieldError id={`${idPrefix}-interval-error`}>{errors.intervalWeeks}</FieldError>
      </section>

      <section aria-labelledby={`${idPrefix}-where-h`} className="flex flex-col gap-3">
        <h2 id={`${idPrefix}-where-h`} className={SECTION_HEADING}>
          Delivery or pickup
        </h2>
        <FulfilmentFields
          idPrefix={idPrefix}
          fulfilment={draft.fulfilment}
          // A different way of receiving it changes which methods exist (no cash on delivery at a counter): choose again.
          onFulfilment={(fulfilment) => onChange({ fulfilment, paymentMethod: null })}
          addresses={addresses}
          addressesFailed={addressBook.isError}
          addressId={draft.addressId}
          onAddress={(addressId) => onChange({ addressId })}
          onAddAddress={(values) => addAddress.mutateAsync(values)}
          branches={outlets.data}
          branchId={draft.branchId}
          onBranch={(branchId) => onChange({ branchId })}
          addressError={errors.deliveryAddressId}
          branchError={errors.pickupBranchId}
          focusAddress={focusAddress}
        />
        <FieldError id={`${idPrefix}-fulfilment-error`}>{errors.fulfilment}</FieldError>
      </section>

      <section aria-labelledby={`${idPrefix}-pay-h`} className="flex flex-col gap-3">
        <h2 id={`${idPrefix}-pay-h`} className={SECTION_HEADING}>
          {PAYMENT_HEADING}
        </h2>
        {!addressOrBranchId ? (
          <p className="m-0 text-sm text-ink-muted">
            {draft.fulfilment === 'Delivery'
              ? PAY_CHOOSE_ADDRESS
              : PAY_CHOOSE_OUTLET}
          </p>
        ) : methods.isPending ? (
          <p role="status" className="m-0 text-sm text-ink-muted">
            {PAY_CHECKING}
          </p>
        ) : methods.isError ? (
          <p role="status" className={cn(bannerWarnClass, 'm-0 font-semibold')}>
            <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
            {PAY_CHECK_FAILED}
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby={`${idPrefix}-pay-h`}
            aria-describedby={errors.paymentMethod ? `${idPrefix}-payment-error` : undefined}
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            {(methodList ?? []).map((option) => {
              const Icon = METHOD_ICONS[option.method] ?? Banknote;
              return (
                <OptionCard
                  key={option.method}
                  name={`${idPrefix}-payment`}
                  checked={draft.paymentMethod === option.method}
                  disabled={!option.isAvailable}
                  onChange={() => onChange({ paymentMethod: option.method })}
                  icon={<Icon size={20} aria-hidden="true" />}
                  title={subscriptionPaymentMethodLabel(option.method)}
                  why={
                    !option.isAvailable && option.unavailableReason ? (
                      <>
                        <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
                        {option.unavailableReason}
                      </>
                    ) : undefined
                  }
                  whyId={`${idPrefix}-pay-${option.method}-why`}
                />
              );
            })}
          </div>
        )}
        <p role="status" className="m-0 text-[13px] font-semibold text-warning-ink empty:hidden">
          {swapNote}
        </p>
        <FieldError id={`${idPrefix}-payment-error`}>{errors.paymentMethod}</FieldError>
        {draft.paymentMethod && (
          <p className="m-0 text-[13px] text-ink-muted">{howPayingWorks(draft.paymentMethod)}</p>
        )}
      </section>
    </div>
  );
}
