'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mainActionClass } from '@/components/hearth/buttons';
import { bannerWarnClass } from '@/components/hearth/card';
import { TriangleAlert } from 'lucide-react';
import type { SubscriptionOptions } from '@/lib/api/subscriptions';
import {
  useCreateSubscription,
  useRefreshPaymentMethods,
} from '@/lib/hooks/useSubscriptions';
import { firstDeliveryHelp } from '@/lib/subscriptions/copy';
import {
  hasSubscriptionCode,
  subscriptionFieldErrors,
  type SubscriptionFieldErrors,
} from '@/lib/subscriptions/errors';
import { cn } from '@/lib/utils';
import { FirstDeliveryField } from './FirstDeliveryField';
import { SubscribePrice, SubscribeProduct } from './SubscribeSummary';
import { TermsFields } from './TermsFields';
import { draftProblems, hasProblems, termsRequestFields, type TermsDraft } from './termsDraft';

/** "Every 4 weeks" is the usual start; the list is the server's, so fall back to its first. */
function initialDraft(options: SubscriptionOptions): TermsDraft {
  const allowed = options.allowedIntervalWeeks;
  return {
    quantity: 1,
    intervalWeeks: allowed.includes(4) ? 4 : (allowed[0] ?? 4),
    fulfilment: 'Delivery',
    addressId: null,
    branchId: null,
    paymentMethod: null,
  };
}

const SUMMARY_FIELD_ORDER = [
  'skuId',
  'quantity',
  'intervalWeeks',
  'fulfilment',
  'deliveryAddressId',
  'pickupBranchId',
  'paymentMethod',
  'firstDeliveryOn',
  'root',
] as const;

/**
 * The Subscribe form once the options say the product can be subscribed to (HO-P6 §11.2.3): one column, sections in
 * order. Values are kept across a validation error and across the inline "Add a new address" (NFR-USA-5). Submitting
 * sends the first delivery date only when it was changed from the default. A 201 goes to the new subscription's page; a
 * 400 shows an error summary (announced and focused) and the field errors; the `{ error }` 400 reads as the generic sentence.
 */
export function SubscribeFormBody({
  options,
  skuId,
  onCreated,
  onRefreshOptions,
}: {
  options: SubscriptionOptions;
  skuId: string;
  onCreated: () => void;
  onRefreshOptions: () => void;
}) {
  const router = useRouter();
  const create = useCreateSubscription();
  const refreshMethods = useRefreshPaymentMethods();
  const [draft, setDraft] = useState<TermsDraft>(() => initialDraft(options));
  const [firstDelivery, setFirstDelivery] = useState(options.earliestFirstDeliveryOn);
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const patch = useCallback((change: Partial<TermsDraft>) => setDraft((d) => ({ ...d, ...change })), []);

  function show(next: SubscriptionFieldErrors) {
    setErrors(next);
    // Announced by role="alert"; focus moves to it so a keyboard user lands on the list.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const problems = draftProblems(draft, options.maxQuantity);
    if (hasProblems(problems)) return show(problems);
    setErrors({});
    try {
      const view = await create.mutateAsync({
        skuId,
        ...termsRequestFields(draft),
        ...(firstDelivery && firstDelivery !== options.earliestFirstDeliveryOn
          ? { firstDeliveryOn: firstDelivery }
          : {}),
      });
      onCreated();
      router.push(`/portal/subscriptions/${view.id}?subscribed=1`);
    } catch (error) {
      if (hasSubscriptionCode(error, 'PaymentMethodUnavailable')) void refreshMethods();
      if (hasSubscriptionCode(error, 'SubscriptionAlreadyExists')) onRefreshOptions();
      show(subscriptionFieldErrors(error, { subject: 'product' }));
    }
  }

  const messages = SUMMARY_FIELD_ORDER.map((key) => errors[key]).filter(
    (message): message is string => !!message,
  );

  return (
    <form onSubmit={submit} noValidate aria-label="Subscribe" className="flex flex-col gap-7">
      <SubscribeProduct options={options} />

      <TermsFields
        idPrefix="sub"
        skuId={skuId}
        options={options}
        draft={draft}
        onChange={patch}
        errors={errors}
        preselect
      />

      <section aria-labelledby="sub-first-h" className="flex flex-col gap-3">
        <h2 id="sub-first-h" className="m-0 font-display text-lg font-semibold text-ink">
          First delivery
        </h2>
        <FirstDeliveryField
          id="sub-first-delivery"
          label="First delivery date"
          value={firstDelivery}
          onChange={setFirstDelivery}
          min={options.earliestFirstDeliveryOn}
          max={options.latestFirstDeliveryOn}
          help={firstDeliveryHelp(options)}
          error={errors.firstDeliveryOn}
        />
      </section>

      <SubscribePrice options={options} />

      <div
        ref={summaryRef}
        tabIndex={-1}
        role="alert"
        className={cn(
          messages.length === 0
            ? 'sr-only'
            : cn(bannerWarnClass, 'flex-col gap-1 focus:outline-2 focus:outline-offset-2 focus:outline-accent'),
        )}
      >
        {messages.length > 0 && (
          <>
            <p className="m-0 flex items-center gap-2 font-bold">
              <TriangleAlert size={16} aria-hidden="true" />
              We couldn&rsquo;t start your subscription
            </p>
            <ul className="m-0 list-disc pl-6">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Button
        type="submit"
        variant="pill"
        size="pillLg"
        className={mainActionClass}
        disabled={create.isPending}
        aria-busy={create.isPending}
      >
        {create.isPending ? 'Starting your subscription…' : 'Start subscription'}
      </Button>
    </form>
  );
}
