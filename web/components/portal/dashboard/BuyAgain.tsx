'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { ProductPackArt, type PackTone } from '@/components/hearth/ProductPackArt';
import { describeOrderingError } from '@/lib/api/errors';
import { resolveFileUrl } from '@/lib/api/files';
import type { PortalOrderItem } from '@/lib/api/portal';
import { useAddCartLine } from '@/lib/hooks/useCart';
import { useMyOrder } from '@/lib/hooks/useMyOrders';
import { cn } from '@/lib/utils';

const MAX_LINES = 4;
const TONES: PackTone[] = ['warm', 'sunken', 'teal'];

/** The newest delivered order in the dashboard's orders, or null. */
export function newestDeliveredOrder(items: PortalOrderItem[]): PortalOrderItem | null {
  const delivered = items.filter((order) => order.status === 'Delivered');
  delivered.sort((a, b) => Date.parse(b.placedOn) - Date.parse(a.placedOn));
  return delivered[0] ?? null;
}

/**
 * `components/portal/dashboard/BuyAgain.tsx` — the overview's "Buy again" (docs/design/store/Account.dc.html), the
 * interim version for backend gap G7: the lines of the newest delivered order, up to four, each with a 44px "+" that
 * adds that SKU once to the basket and turns into a tick. No price is shown (the basket prices it, from the server);
 * nothing is computed here.
 */
export function BuyAgain({ order }: { order: PortalOrderItem }) {
  const detail = useMyOrder(order.orderId);
  const add = useAddCartLine();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const lines = detail.data?.lines.slice(0, MAX_LINES) ?? [];

  if (lines.length === 0) return null;

  function onAdd(skuId: string) {
    setError(null);
    add.mutate(
      { skuId, quantity: 1 },
      {
        onSuccess: () => setAdded((current) => new Set(current).add(skuId)),
        onError: (failure) => setError(describeOrderingError(failure)),
      },
    );
  }

  return (
    <section aria-labelledby="acc-again" className="flex flex-col gap-3.5">
      <h2 id="acc-again" className="m-0 font-display text-[26px] font-bold text-ink">
        Buy again
      </h2>
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3.5 p-0">
        {lines.map((line, index) => {
          const name = `${line.productName} ${line.variantLabel}`.trim();
          const done = added.has(line.skuId);
          const image = resolveFileUrl(line.imagePath);
          return (
            <li
              key={line.lineId}
              className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: no next/image remote config
                <img
                  src={image}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  className="size-14 flex-none rounded-[14px] object-contain"
                />
              ) : (
                <ProductPackArt
                  tone={TONES[index % TONES.length]!}
                  className="size-14 flex-none rounded-[14px]"
                />
              )}
              <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                {name}
              </span>
              <button
                type="button"
                onClick={() => onAdd(line.skuId)}
                disabled={done || add.isPending}
                aria-label={done ? `${name} added to your basket` : `Add ${name} to basket`}
                className={cn(
                  'grid size-11 flex-none place-items-center rounded-full',
                  done ? 'bg-leaf text-leaf-soft' : 'bg-warm text-ink',
                )}
              >
                {done ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
