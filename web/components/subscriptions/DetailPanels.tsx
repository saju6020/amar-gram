import type { ReactNode } from 'react';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { Amount } from '@/components/billing/Amount';
import { bannerWarnClass, cardClass } from '@/components/hearth/card';
import type { PublicBranch } from '@/lib/api/admin-branches';
import type { SubscriptionView } from '@/lib/api/subscriptions';
import {
  CHOOSE_ANOTHER_ADDRESS,
  DELIVERY_ADDRESS_MISSING_TEXT,
  NO_DELIVERY_SCHEDULED,
  endedOnText,
  pendingChangeLines,
  placeText,
  NEXT_DELIVERY_HELP,
  PAUSED_NO_DELIVERIES_TEXT,
  cutoffSentence,
  estimateDiscountLabel,
  lockedSentence,
  nextDeliveryLabel,
} from '@/lib/subscriptions/copy';
import { formatCommerceInstantLong, isZeroPercent } from '@/lib/subscriptions/dates';
import {
  intervalLabel,
  subscriptionFulfilmentLabel,
  subscriptionPaymentMethodLabel,
  suspensionReasonCustomerText,
} from '@/lib/subscriptions/labels';
import { cn } from '@/lib/utils';

export function Panel({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn(cardClass, 'flex min-w-0 flex-col gap-3', className)}>
      <h2 id={id} className="m-0 font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * "Next delivery" (HO-P6 §11.2.5). Active: the date, why it is the order date (ADR-239) and either the cut-off sentence or,
 * only when the server says `isLocked`, the locked sentence naming `followingDeliveryOn`. Paused and Cancelled say so.
 */
export function NextDeliveryPanel({ subscription }: { subscription: SubscriptionView }) {
  const { status, nextDeliveryOn, changeCutoffOn, isLocked, followingDeliveryOn } = subscription;
  return (
    <Panel id="sub-next-h" title="Next delivery">
      {status === 'Active' && nextDeliveryOn ? (
        <>
          <p className="m-0 flex items-center gap-2 text-lg font-bold text-ink">
            <CalendarClock size={20} aria-hidden="true" className="flex-none text-leaf-ink" />
            {nextDeliveryLabel(nextDeliveryOn)}
          </p>
          <p className="m-0 text-sm text-ink-muted">{NEXT_DELIVERY_HELP}</p>
          {isLocked ? (
            <p className="m-0 text-sm font-semibold text-warning-ink">
              {lockedSentence({ nextDeliveryOn, followingDeliveryOn })}
            </p>
          ) : (
            changeCutoffOn && (
              <p className="m-0 text-sm text-ink-muted">
                {cutoffSentence({
                  changeCutoffOn,
                  nextDeliveryOn,
                  commerceTimeZoneId: subscription.commerceTimeZoneId,
                })}
              </p>
            )
          )}
        </>
      ) : status === 'Paused' ? (
        <p className="m-0 text-ink">{PAUSED_NO_DELIVERIES_TEXT}</p>
      ) : status === 'Cancelled' ? (
        <p className="m-0 text-ink">
          {`${endedOnText(formatCommerceInstantLong(subscription.cancelledOn, subscription.commerceTimeZoneId))}.`}
        </p>
      ) : (
        <p className="m-0 text-ink-muted">{`${NO_DELIVERY_SCHEDULED}.`}</p>
      )}
    </Panel>
  );
}

/** Why a subscription is suspended and what to do (§10.2). For unpaid orders it adds every outlet's name and phone (OQ-14). */
export function SuspensionBanner({
  subscription,
  outlets,
}: {
  subscription: SubscriptionView;
  outlets: PublicBranch[] | undefined;
}) {
  if (subscription.status !== 'Suspended') return null;
  const contacts =
    subscription.suspensionReason === 'UnpaidCycles'
      ? (outlets ?? []).filter((outlet) => outlet.phoneNumber)
      : [];
  return (
    <div role="status" className={cn(bannerWarnClass, 'flex-col gap-2')}>
      <p className="m-0 flex items-start gap-2 font-bold">
        <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
        {suspensionReasonCustomerText(subscription.suspensionReason)}
      </p>
      {contacts.length > 0 && (
        <ul aria-label="Contact the shop" className="m-0 list-none pl-6">
          {contacts.map((outlet) => (
            <li key={outlet.id}>{`${outlet.name}: ${outlet.phoneNumber}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What is scheduled, each with the date the server names (`pending.appliesFromCycleOn`). Absent when nothing is. */
export function PendingChangesPanel({ subscription }: { subscription: SubscriptionView }) {
  const lines = pendingChangeLines(subscription, 'customer');
  if (lines.length === 0) return null;
  return (
    <Panel id="sub-pending-h" title="Scheduled changes">
      <ul className="m-0 list-disc pl-5 text-ink">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-ink-muted sm:w-40 sm:flex-none">{label}</dt>
      <dd className="m-0 min-w-0 text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** The terms: quantity, how often, where, payment. A removed address is a warning with the way to choose another. */
export function TermsPanel({
  subscription,
  onChooseAddress,
}: {
  subscription: SubscriptionView;
  onChooseAddress?: () => void;
}) {
  const { terms } = subscription;
  return (
    <Panel id="sub-terms-h" title="Your subscription">
      <dl className="m-0 flex flex-col gap-2">
        <Row label="Quantity">{terms.quantity}</Row>
        <Row label="How often">{intervalLabel(terms.intervalWeeks)}</Row>
        <Row label={subscriptionFulfilmentLabel(terms.fulfilment)}>{placeText(terms)}</Row>
        <Row label="Payment">{subscriptionPaymentMethodLabel(terms.paymentMethod)}</Row>
      </dl>
      {terms.deliveryAddressMissing && (
        <p className={cn(bannerWarnClass, 'm-0 flex-wrap items-center font-semibold')}>
          <TriangleAlert size={15} aria-hidden="true" className="flex-none" />
          <span>{DELIVERY_ADDRESS_MISSING_TEXT}</span>
          {onChooseAddress && (
            <button
              type="button"
              onClick={onChooseAddress}
              className="min-h-11 font-semibold text-accent-ink underline"
            >
              {CHOOSE_ANOTHER_ADDRESS}
            </button>
          )}
        </p>
      )}
    </Panel>
  );
}

/**
 * The server's estimate, as sent (ADR-FE-113): quantity × unit price, subtotal, the discount rate and amount, the estimated
 * total per delivery and the server's note. Nothing is calculated here. Absent when the server sends none.
 */
export function EstimatePanel({ subscription }: { subscription: SubscriptionView }) {
  const estimate = subscription.estimate;
  if (!estimate) return null;
  const hasDiscount = !isZeroPercent(estimate.discountPercent);
  return (
    <Panel id="sub-estimate-h" title="Estimate for each delivery">
      <dl className="m-0 flex flex-col gap-2">
        <Row label="Items">
          {estimate.quantity} × <Amount money={estimate.unitPrice} />
        </Row>
        <Row label="Subtotal">
          <Amount money={estimate.subtotal} />
        </Row>
        {hasDiscount && (
          <Row label={estimateDiscountLabel(estimate.discountPercent)}>
            −<Amount money={estimate.discountAmount} />
          </Row>
        )}
        <Row label="Estimated per delivery">
          <strong>
            <Amount money={estimate.estimatedTotal} />
          </strong>
        </Row>
      </dl>
      <p className="m-0 text-[13px] text-ink-muted">{estimate.note}</p>
    </Panel>
  );
}
