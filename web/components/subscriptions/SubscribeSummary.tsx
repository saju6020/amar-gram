import { Amount } from '@/components/billing/Amount';
import { cardClass } from '@/components/hearth/card';
import type { SubscriptionOptions } from '@/lib/api/subscriptions';
import { FORM_ESTIMATE_NOTE, discountRateText } from '@/lib/subscriptions/copy';
import { cn } from '@/lib/utils';
import { ProductThumb } from './ProductThumb';

/** The product the form is about: picture, name, variant and the unit price as the server sent it. */
export function SubscribeProduct({ options }: { options: SubscriptionOptions }) {
  return (
    <section aria-labelledby="sub-product-h" className={cn(cardClass, 'flex items-center gap-4')}>
      <ProductThumb imageUrl={options.sku.imageUrl} className="size-20" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="sub-product-h" className="m-0 font-display text-xl font-semibold text-ink [overflow-wrap:anywhere]">
          {options.sku.productName}
        </h2>
        {options.sku.variantLabel && (
          <p className="m-0 text-sm text-ink-muted">{options.sku.variantLabel}</p>
        )}
        {options.unitPrice && (
          <p className="m-0 text-base font-semibold text-ink">
            <Amount money={options.unitPrice} /> each
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * "Price" (OQ-3): the unit price, the subscriber discount as a rate in words, and the server's estimate note. There is
 * no total here: before the subscription exists the server has no figure and the browser may not compute one
 * (ADR-FE-113). The server's estimate appears on the subscription's page.
 */
export function SubscribePrice({ options }: { options: SubscriptionOptions }) {
  const rate = discountRateText(options.discountPercent);
  return (
    <section aria-labelledby="sub-price-h" className="flex flex-col gap-2">
      <h2 id="sub-price-h" className="m-0 font-display text-lg font-semibold text-ink">
        Price
      </h2>
      {options.unitPrice && (
        <p className="m-0 text-[15px] text-ink">
          Each pack: <Amount money={options.unitPrice} />
        </p>
      )}
      {rate && <p className="m-0 text-[15px] font-semibold text-leaf-ink">{rate}</p>}
      <p className="m-0 text-[13px] text-ink-muted">{FORM_ESTIMATE_NOTE}</p>
    </section>
  );
}
