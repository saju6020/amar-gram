import { Banknote, Check, MapPin, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The delivery-and-payment facts the shop may state (docs/design/shop/README.md, owner decision
 * 2026-10-16). Only true rules: the delivery slot and fee are chosen and shown at checkout, pickup
 * is at a branch, and payment is cash on delivery or bank transfer. No dates, fees or speed claims.
 */
const FACTS = [
  {
    key: 'delivery',
    icon: Truck,
    title: 'Delivery across Dhaka',
    text: 'Pick a delivery slot at checkout. The fee is shown before you place the order.',
    tone: 'warm',
  },
  {
    key: 'pickup',
    icon: MapPin,
    title: 'Or pick it up at a branch',
    text: 'Choose pickup at checkout and collect from the branch you pick.',
    tone: 'teal',
  },
  {
    key: 'pay',
    icon: Banknote,
    title: 'Pay when it arrives',
    text: 'Cash on delivery, or bank transfer.',
    tone: 'teal',
  },
] as const;

const TILE_TONE = {
  warm: 'bg-warm-soft text-warm-ink',
  teal: 'bg-accent-tint text-accent',
} as const;

/** The card under the product page's buy row. */
export function DeliveryPromiseCard({ className }: { className?: string }) {
  return (
    <section
      aria-label="Delivery and payment"
      className={cn(
        'rounded-card border-[1.5px] border-border bg-surface px-[18px] py-1.5',
        className,
      )}
    >
      <ul className="m-0 list-none p-0">
        {FACTS.map(({ key, icon: Icon, title, text, tone }) => (
          <li
            key={key}
            className="flex items-center gap-3.5 border-b border-border py-3.5 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-10 flex-none place-items-center rounded-[12px]',
                TILE_TONE[tone],
              )}
            >
              <Icon size={20} />
            </span>
            <span className="flex flex-col">
              <strong className="text-sm text-ink">{title}</strong>
              <span className="text-[13px] text-ink-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The storefront home's promise strip (Home.dc.html): dashed cards with a leaf tick. True facts
 * only: certified items are marked, payment is cash on delivery, returns are for eligible items, and
 * delivery or branch pickup is chosen at checkout. No origin-village claim (G1), no free-delivery
 * amount (G5).
 */
const PROMISES = [
  { key: 'organic', title: 'Organic where we say so', text: 'Certified items are marked' },
  { key: 'cod', title: 'Cash on delivery', text: 'Pay when it reaches you' },
  { key: 'returns', title: 'Returns on eligible items', text: 'Ask from your order page' },
  { key: 'delivery', title: 'Delivery or branch pickup', text: 'Choose at checkout' },
] as const;

export function PromiseStrip({ className }: { className?: string }) {
  return (
    <section aria-label="Why shop with us" className={className}>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map(({ key, title, text }) => (
          <li
            key={key}
            className="flex items-start gap-3.5 rounded-card border-[1.5px] border-dashed border-border-strong p-5"
          >
            <span
              aria-hidden="true"
              className="grid size-10 flex-none place-items-center rounded-pill bg-leaf-soft text-leaf-ink"
            >
              <Check size={20} strokeWidth={2} />
            </span>
            <span className="flex flex-col">
              <strong className="text-base text-ink">{title}</strong>
              <span className="text-sm text-ink-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
