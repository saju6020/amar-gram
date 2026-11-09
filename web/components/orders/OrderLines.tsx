import { useState } from 'react';
import { Amount } from '@/components/billing/Amount';
import { ProductPackArt, type PackTone } from '@/components/hearth/ProductPackArt';
import type { Money } from '@/lib/format/money';
import { cn } from '@/lib/utils';

/**
 * `components/orders/OrderLines.tsx` — HO-ORD-002 §11.4/§11.6. The lines of a quote or an order as a
 * list: product and variant, quantity, unit price, the tax rate
 * (as the server sent it) and the line total. A list, not a table, so it needs no horizontal scroll at
 * 360 px; the staff screens add batch details through `extra`. The `hearth` appearance (customer
 * screens only) shows a tinted product tile beside each line.
 */
export interface DisplayLine {
  key: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  taxRatePercent?: number;
  /** The line's photo (an absolute, resolved URL); without one the hearth tile is the pack drawing. */
  imageUrl?: string | null;
  /** The server's label for the line's discount ("Subscription discount (10%)"), with the amount taken off; absent for a line with none. */
  discountLabel?: string | null;
  lineDiscount?: Money;
}

const TILE_TONES: PackTone[] = ['warm', 'sunken', 'teal'];

/** The hearth line tile: the photo when there is one and it loads, else the tinted pack drawing. */
function LineTile({ imageUrl, tone }: { imageUrl?: string | null; tone: PackTone }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (imageUrl && imageUrl !== failedSrc) {
    return (
      <span className="grid size-[68px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: no next/image remote config */}
        <img
          src={imageUrl}
          alt=""
          width={68}
          height={68}
          loading="lazy"
          onError={() => setFailedSrc(imageUrl)}
          className="size-full object-contain p-1"
        />
      </span>
    );
  }
  return <ProductPackArt tone={tone} className="size-[68px] rounded-2xl" />;
}

export function OrderLines({
  lines,
  caption,
  extra,
  appearance = 'plain',
}: {
  lines: DisplayLine[];
  caption: string;
  extra?: (line: DisplayLine) => React.ReactNode;
  appearance?: 'plain' | 'hearth';
}) {
  const hearth = appearance === 'hearth';
  return (
    <ul aria-label={caption} className="m-0 flex list-none flex-col p-0">
      {lines.map((line, index) => (
        <li
          key={line.key}
          className={cn(
            'flex justify-between gap-x-4 gap-y-1 border-b border-border last:border-0',
            hearth ? 'items-center gap-4 py-4' : 'flex-wrap items-start py-3',
          )}
        >
          {hearth && (
            <LineTile imageUrl={line.imageUrl} tone={TILE_TONES[index % TILE_TONES.length]!} />
          )}
          <div className={cn('min-w-0 flex-1', hearth ? 'flex flex-col gap-1' : 'basis-56')}>
            <p
              className={cn(
                'font-semibold text-ink [overflow-wrap:anywhere]',
                hearth && 'text-[15px] font-bold',
              )}
            >
              {hearth ? `${line.productName} ${line.variantLabel}`.trim() : line.productName}
            </p>
            <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
              {!hearth && line.variantLabel}
              {!hearth && line.variantLabel ? ' · ' : ''}Qty {line.quantity} ·{' '}
              <Amount money={line.unitPrice} /> each
              {line.taxRatePercent !== undefined
                ? hearth
                  ? ` · tax rate ${line.taxRatePercent}%`
                  : ` · tax ${line.taxRatePercent}%`
                : ''}
            </p>
            {line.discountLabel && line.lineDiscount && (
              <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
                {line.discountLabel} <Amount money={line.lineDiscount} />
              </p>
            )}
            {extra?.(line)}
          </div>
          <p
            className={cn(
              'whitespace-nowrap font-semibold text-ink',
              hearth && 'text-base font-bold',
            )}
          >
            <Amount money={line.lineTotal} />
          </p>
        </li>
      ))}
    </ul>
  );
}
