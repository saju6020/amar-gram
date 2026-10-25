import Link from 'next/link';
import { AvailabilityText } from './StatusText';
import type { BundleComponent } from '@/lib/api/shop-catalogue';

/** HO-SHP-002 §11.3 `BundleContents` — *This kit contains*: each component, its variant, quantity
 *  and availability as text (US-SHP-12). A kit is unavailable when a component is — the server says
 *  so in the kit's own `availability`. */
export function BundleContents({
  components,
  lang,
}: {
  components: BundleComponent[];
  lang?: string;
}) {
  if (components.length === 0) return null;
  return (
    <section aria-labelledby="bundle-heading" className="flex flex-col gap-3">
      <h2 id="bundle-heading" className="m-0 font-display text-2xl font-bold text-ink">
        This kit contains
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {components.map((component) => (
          <li
            key={`${component.productSlug}-${component.skuLabel}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 text-sm"
          >
            <span>
              {component.quantity} ×{' '}
              <Link
                href={`/shop/products/${encodeURIComponent(component.productSlug)}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`}
                className="font-semibold text-accent-ink"
              >
                {component.productName}
              </Link>{' '}
              <span className="text-ink-muted">({component.skuLabel})</span>
            </span>
            <AvailabilityText availability={component.availability} />
          </li>
        ))}
      </ul>
    </section>
  );
}
