'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { useQuickAdd } from '@/components/catalogue/ProductCard';
import { ProductPackArt } from '@/components/hearth/ProductPackArt';
import { formatPriceRange } from '@/lib/format/shop';
import { productHref } from '@/lib/shop/helpers';
import { cn } from '@/lib/utils';
import type { CatalogueItem } from '@/lib/api/shop-catalogue';

const TONES = ['warm', 'sunken', 'teal'] as const;
const TILE_BG = {
  warm: 'bg-warm-soft',
  sunken: 'bg-surface-sunken',
  teal: 'bg-accent-tint',
} as const;

function Tile({
  item,
  index,
  lang,
  onMessage,
}: {
  item: CatalogueItem;
  index: number;
  lang?: string;
  onMessage: (text: string, kind: 'ok' | 'problem') => void;
}) {
  const href = productHref(item.slug, { lang });
  const quickAdd = useQuickAdd(item, href, onMessage);
  const tone = TONES[index % TONES.length]!;
  const outOfStock = item.availability === 'OutOfStock';
  const title = item.sizeLabel ? `${item.name} · ${item.sizeLabel}` : item.name;
  return (
    <li className="flex min-w-0 flex-col gap-2.5">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          'grid aspect-[4/3] place-items-center overflow-hidden rounded-[20px]',
          TILE_BG[tone],
        )}
      >
        <ProductPackArt
          tone={tone}
          className="size-full rounded-none bg-transparent [&>svg]:h-[70%]"
        />
      </Link>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={href}
          className="text-base font-semibold text-ink no-underline hover:text-accent hover:underline"
        >
          {item.name}
        </Link>
        <span className="text-[15px] text-ink-muted">
          {formatPriceRange(item.fromPrice, item.priceVaries)}
          {item.sizeLabel ? ` · ${item.sizeLabel}` : ''}
          {outOfStock ? ' · Out of stock' : ''}
        </span>
      </div>
      {outOfStock ? (
        <Link
          href={`${href}#stock-alert`}
          aria-label={`Tell me when ${item.name} is back`}
          className={buttonVariants({
            variant: 'pillSecondary',
            size: 'pillMd',
            className: 'self-start px-4',
          })}
        >
          Alert me
        </Link>
      ) : (
        <Button
          variant="pill"
          size="pillMd"
          className="self-start bg-warm px-5 font-bold text-ink hover:bg-warm-soft"
          aria-busy={quickAdd.busy || undefined}
          aria-label={
            quickAdd.chooseOnPage ? `Add ${title}: choose options` : `Add ${title} to basket`
          }
          onClick={() => void quickAdd.run()}
        >
          {quickAdd.busy ? 'Adding…' : 'Add'}
        </Button>
      )}
    </li>
  );
}

/**
 * HO-SHP-002 §11.3, US-SHP-08, restyled for HO-P3 S2 — "Goes well with": the server's
 * frequently-bought-together list as the design's compact tiles (pack drawing, name, "price · size",
 * Add). Each Add follows the catalogue card's quick-add rule (one size adds straight to the basket,
 * several sizes go to the product page, an out-of-stock item offers Alert me). Renders nothing when
 * the list is empty.
 */
export function OftenBoughtTogether({ items, lang }: { items: CatalogueItem[]; lang?: string }) {
  const [note, setNote] = React.useState<{ text: string; kind: 'ok' | 'problem' } | null>(null);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="fbt-title" className="flex flex-col gap-5">
      <h2 id="fbt-title" className="m-0 font-display text-[30px] font-bold text-ink">
        Goes well with
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0 md:grid-cols-4">
        {items.slice(0, 4).map((item, index) => (
          <Tile
            key={item.productId}
            item={item}
            index={index}
            lang={lang}
            onMessage={(text, kind) => setNote({ text, kind })}
          />
        ))}
      </ul>
      <p
        role={note?.kind === 'problem' ? 'alert' : 'status'}
        className={cn(
          'm-0 text-sm font-semibold empty:hidden',
          note?.kind === 'problem' ? 'text-danger-ink' : 'text-leaf-ink',
        )}
      >
        {note?.text}
        {note?.kind === 'ok' && (
          <>
            {' '}
            <Link href="/cart" className="underline">
              View basket
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
