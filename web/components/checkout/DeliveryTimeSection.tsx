'use client';

import { Clock, Truck, Zap } from 'lucide-react';
import { Amount } from '@/components/billing/Amount';
import { IconTile } from '@/components/hearth/IconTile';
import { OptionCard } from '@/components/hearth/OptionCard';
import type { FulfilmentChoice, QuoteServiceLevel, ServiceLevel } from '@/lib/api/checkout';
import { formatDeliverySlot, formatSlotDay, serviceLevelLabel } from '@/lib/format/orders';
import { cn } from '@/lib/utils';
import { CheckoutSection } from './CheckoutSection';

/** "Delivery in 1–2 days" from the server's `leadTimeDays` (OQ-3: shown when there are no windows). */
export function leadTimeText(days: number): string {
  if (days <= 0) return 'Same-day delivery';
  return `Delivery in about ${days} ${days === 1 ? 'day' : 'days'}`;
}

const CHIP =
  'inline-flex items-center justify-center rounded-pill border px-5 text-[15px] font-semibold ' +
  'min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const CHIP_OFF = 'border-border-strong bg-surface text-ink hover:border-ink-muted';
const CHIP_ON = 'border-leaf bg-leaf-soft text-ink ring-1 ring-leaf';

const NOTE = 'm-0 text-sm text-ink-muted';

/**
 * `components/checkout/DeliveryTimeSection.tsx` — section 2 of the single-page checkout (HO-P3 S3, ADR-FE-175;
 * HO-ORD-002 US-ORD-03 AC1/US-ORD-06 AC1). Service levels as choice cards showing the **charge** (the
 * server's string) and the lead time; for the chosen level its delivery windows, labelled in branch time.
 * A level with no windows needs no choice (OQ-3): the section says so, and **Payment stays reachable**.
 * Collection needs no time, and with no usable address the section says what is missing. Nothing here
 * prices or schedules anything.
 */
export function DeliveryTimeSection({
  fulfilment,
  ready,
  loading,
  levels,
  selectedLevel,
  onLevel,
  slotDate,
  slotWindowStart,
  onSlot,
  zone,
  error,
}: {
  fulfilment: FulfilmentChoice;
  /** Delivery is chosen with an address the quote can deliver to. */
  ready: boolean;
  /** The quote has not arrived yet. */
  loading: boolean;
  levels: QuoteServiceLevel[];
  selectedLevel: ServiceLevel | null;
  onLevel: (level: ServiceLevel) => void;
  slotDate: string | undefined;
  slotWindowStart: string | undefined;
  onSlot: (date: string, windowStart: string) => void;
  zone: string;
  error?: string | null;
}) {
  const chosen = levels.find((level) => level.level === selectedLevel);
  const dates = chosen ? [...new Set(chosen.slots.map((slot) => slot.date))] : [];
  const activeDate = slotDate ?? dates[0];
  const noWindows = levels.length > 0 && levels.every((level) => level.slots.length === 0);

  let body;
  if (fulfilment === 'Pickup') {
    body = <p className={NOTE}>Not needed for collection — you pick it up when it is ready.</p>;
  } else if (loading) {
    body = (
      <p role="status" className={NOTE}>
        Checking delivery times…
      </p>
    );
  } else if (!ready || levels.length === 0) {
    body = (
      <p className={NOTE}>
        Choose an address we can deliver to above, and the delivery times appear here.
      </p>
    );
  } else {
    body = (
      <>
        <div role="radiogroup" aria-label="Delivery option" className="grid gap-3 sm:grid-cols-2">
          {levels.map((level) => (
            <OptionCard
              key={level.level}
              name="service-level"
              checked={selectedLevel === level.level}
              onChange={() => onLevel(level.level)}
              icon={
                level.level === 'Express' ? (
                  <Zap size={20} aria-hidden="true" />
                ) : (
                  <Truck size={20} aria-hidden="true" />
                )
              }
              title={serviceLevelLabel(level.level)}
              trailing={<Amount money={level.charge} />}
            >
              {level.slots.length === 0
                ? leadTimeText(level.leadTimeDays)
                : 'Choose a delivery time window'}
            </OptionCard>
          ))}
        </div>
        {noWindows && (
          <p className={NOTE}>
            This delivery has no time windows to choose from, so there is nothing to pick here.
            Payment is next.
          </p>
        )}
        {chosen && chosen.slots.length > 0 && (
          <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
            <legend className="sr-only">{`Delivery time (${zone})`}</legend>
            <div className="flex items-center gap-3.5">
              <IconTile shape="tile" tone="warm" size="md">
                <Clock size={20} aria-hidden="true" />
              </IconTile>
              <div>
                <p className="m-0 text-base font-bold text-ink">When should we come?</p>
                <p className="m-0 text-[13px] text-ink-muted">{`All times ${zone}`}</p>
              </div>
            </div>
            <div role="radiogroup" aria-label="Delivery date" className="flex flex-wrap gap-2.5">
              {dates.map((date) => {
                const sample = chosen.slots.find((slot) => slot.date === date);
                return (
                  <button
                    key={date}
                    type="button"
                    role="radio"
                    aria-checked={activeDate === date}
                    onClick={() => {
                      const first = chosen.slots.find((slot) => slot.date === date);
                      if (first) onSlot(first.date, first.windowStart);
                    }}
                    className={cn(
                      CHIP,
                      'min-h-16 rounded-2xl',
                      activeDate === date ? CHIP_ON : CHIP_OFF,
                    )}
                  >
                    {sample ? formatSlotDay(sample.date) : date}
                  </button>
                );
              })}
            </div>
            <div role="radiogroup" aria-label="Time window" className="flex flex-wrap gap-2.5">
              {chosen.slots
                .filter((slot) => slot.date === activeDate)
                .map((slot) => {
                  const selected = slotDate === slot.date && slotWindowStart === slot.windowStart;
                  return (
                    <button
                      key={`${slot.date}-${slot.windowStart}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSlot(slot.date, slot.windowStart)}
                      className={cn(CHIP, selected ? CHIP_ON : CHIP_OFF)}
                    >
                      {`${slot.windowStart}–${slot.windowEnd}`}
                    </button>
                  );
                })}
            </div>
            {slotDate && slotWindowStart && (
              <p className="m-0 text-sm text-ink-muted" role="status">
                {`Selected: ${formatDeliverySlot(slotDate, slotWindowStart, chosen.slots.find((s) => s.date === slotDate && s.windowStart === slotWindowStart)?.windowEnd ?? '', zone)}`}
              </p>
            )}
          </fieldset>
        )}
      </>
    );
  }

  return (
    <CheckoutSection id="co-time" step={2} title="Delivery time">
      {body}
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </CheckoutSection>
  );
}
