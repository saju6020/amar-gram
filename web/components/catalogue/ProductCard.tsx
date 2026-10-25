'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { resolveFileUrl } from '@/lib/api/files';
import { Check, Globe, Heart, Package } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ProductPackArt } from '@/components/hearth/ProductPackArt';
import { PACK_BG, packToneForCategory } from '@/components/hearth/packTone';
import { AvailabilityText, RatingText } from '@/components/product/StatusText';
import type { CartLine } from '@/lib/api/cart';
import { getProductDetail, type CatalogueItem } from '@/lib/api/shop-catalogue';
import { QuantityStepper } from '@/components/cart/QuantityStepper';
import { useAddCartLine, useCart, useRemoveCartLine, useUpdateCartLine } from '@/lib/hooks/useCart';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { useCustomerSession } from '@/lib/hooks/useSession';
import { useSetWishlistItem, useWishlist } from '@/lib/hooks/useShopCustomer';
import { countryFlag, formatPriceRange } from '@/lib/format/shop';
import { productHref } from '@/lib/shop/helpers';
import { cn } from '@/lib/utils';

export interface ProductCardProps {
  item: CatalogueItem;
  /** Content language carried onto the product link (ADR-FE-037). */
  lang?: string;
  headingLevel?: 'h2' | 'h3';
}

const ROUND_BUTTON =
  'absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-pill border-0 bg-surface p-0 text-warm-ink ' +
  'hover:bg-warm-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Reads a product's SKUs once (shared cache with the product page's own client read). */
function useProductSkus() {
  const queryClient = useQueryClient();
  return React.useCallback(
    (slug: string) =>
      queryClient
        .fetchQuery({
          queryKey: ['shop', 'product', slug],
          queryFn: () => getProductDetail(slug),
          staleTime: 60_000,
        })
        .then((detail) => detail.skus),
    [queryClient],
  );
}

/** "Kalijira Rice · 1 kg" — the card's name with its size, for messages and labels. */
function cardTitle(item: CatalogueItem): string {
  return item.sizeLabel ? `${item.name} · ${item.sizeLabel}` : item.name;
}

/**
 * This card's line in the basket, from the cart the header already loads (no extra request): the line for
 * this size, or - for a card that is not a single size - the product's line when it has exactly one. `null`
 * when it is not in the basket (or a product has several lines, which only the product page can edit).
 */
function useBasketLine(item: CatalogueItem) {
  const cart = useCart();
  // The cart can already be cached when the page hydrates; count from the next render so the first
  // client render matches the server HTML (the /cart fix, 2026-10-16).
  const hydrated = useHydrated();
  const lines = hydrated ? (cart.data?.lines ?? []) : [];
  const matching = lines.filter((line) =>
    item.skuId ? line.skuId === item.skuId : line.productId === item.productId,
  );
  const line = matching.length === 1 ? matching[0]! : null;
  return {
    line,
    inBasket: matching.reduce((sum, entry) => sum + entry.quantity, 0),
    maxPerLine: cart.data?.maxQuantityPerLine ?? 10,
  };
}

/**
 * The card's wishlist heart. A toggle (`aria-pressed`) over the SKUs of this product the shopper
 * saved. A card carries no SKU id, so saving reads the product: one size saves directly, several
 * sizes lead to the product page to choose. A guest is sent to sign in and returned.
 */
function CardWishlistButton({
  item,
  href,
  onProblem,
}: {
  item: CatalogueItem;
  href: string;
  onProblem: (text: string) => void;
}) {
  const router = useRouter();
  const session = useCustomerSession();
  const signedIn = !!session.data;
  const wishlist = useWishlist(signedIn);
  const setWishlist = useSetWishlistItem();
  const loadSkus = useProductSkus();
  const [busy, setBusy] = React.useState(false);
  const label = `Save ${item.name} to wishlist`;
  const savedSkuIds = (wishlist.data?.items ?? [])
    .filter((entry) => (item.skuId ? entry.skuId === item.skuId : entry.slug === item.slug))
    .map((entry) => entry.skuId);
  const saved = savedSkuIds.length > 0;

  if (!session.isPending && !signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(href)}`}
        aria-label={`${label}: sign in first`}
        className={ROUND_BUTTON}
      >
        <Heart size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }

  async function toggle() {
    if (busy || !signedIn) return;
    setBusy(true);
    try {
      if (saved) {
        for (const skuId of savedSkuIds) await setWishlist.mutateAsync({ skuId, saved: false });
      } else if (item.skuId) {
        // One card per size: the card saves exactly its own size.
        await setWishlist.mutateAsync({ skuId: item.skuId, saved: true });
      } else {
        const skus = await loadSkus(item.slug);
        if (skus.length === 1)
          await setWishlist.mutateAsync({ skuId: skus[0]!.skuId, saved: true });
        else router.push(href);
      }
    } catch {
      onProblem('Could not update your wishlist. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      aria-disabled={busy || session.isPending || undefined}
      onClick={() => void toggle()}
      className={ROUND_BUTTON}
    >
      <Heart size={18} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

/**
 * The quick-add rule for a catalogue item (owner rule 2026-10-16). One size adds straight to the
 * cart (the existing basket mutation); several sizes go to the product page, where the size choice
 * already lives. A card carries no SKU id, so a product that might have one size is read first.
 */
export function useQuickAdd(
  item: CatalogueItem,
  href: string,
  onMessage: (text: string, kind: 'ok' | 'problem') => void,
) {
  const router = useRouter();
  const add = useAddCartLine();
  const loadSkus = useProductSkus();
  const [busy, setBusy] = React.useState(false);
  // One card per size (owner, 2026-10-18): a card that is a size adds that size; only a row that is
  // not a single size still goes to the product page.
  const chooseOnPage = !item.skuId && item.priceVaries;

  async function run() {
    if (busy) return;
    if (chooseOnPage) {
      router.push(href);
      return;
    }
    setBusy(true);
    try {
      if (item.skuId) {
        if (item.availability !== 'InStock' || !item.fromPrice) {
          onMessage(`${item.name} is not available to add right now.`, 'problem');
        } else {
          await add.mutateAsync({ skuId: item.skuId, quantity: 1 });
          onMessage(`Added ${cardTitle(item)} to your basket.`, 'ok');
        }
        return;
      }
      const skus = await loadSkus(item.slug);
      const only = skus.length === 1 ? skus[0]! : null;
      if (!only) {
        router.push(href);
      } else if (only.availability !== 'InStock' || !only.price) {
        onMessage(`${item.name} is not available to add right now.`, 'problem');
      } else {
        await add.mutateAsync({ skuId: only.skuId, quantity: 1 });
        onMessage(`Added ${item.name} to your basket.`, 'ok');
      }
    } catch {
      onMessage('Could not add this to your basket. Please try again.', 'problem');
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, chooseOnPage };
}

/** The leaf quantity stepper that replaces Add once this size is in the basket (D-7, ADR-FE-178). */
function CardStepper({
  item,
  line,
  maxPerLine,
  onMessage,
}: {
  item: CatalogueItem;
  line: CartLine;
  maxPerLine: number;
  onMessage: (text: string, kind: 'ok' | 'problem') => void;
}) {
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const busy = update.isPending || remove.isPending;
  const title = cardTitle(item);
  const available = line.availableQuantity;
  const limited = typeof available === 'number' && available < maxPerLine;
  const max = limited ? available : maxPerLine;
  const maxReason =
    typeof available === 'number' && available <= maxPerLine
      ? `You can’t add more: only ${available} in stock.`
      : `You can add up to ${maxPerLine} of one item.`;
  const problem = () => onMessage('Could not change your basket. Please try again.', 'problem');

  function change(quantity: number) {
    if (busy) return;
    if (quantity <= 0) {
      // At 1, "−" removes the line (the existing remove call) and says so.
      remove.mutate(line.lineId, {
        onSuccess: () => onMessage(`Removed ${title} from your basket.`, 'ok'),
        onError: problem,
      });
      return;
    }
    update.mutate({ lineId: line.lineId, quantity }, { onError: problem });
  }

  return (
    <QuantityStepper
      label={title}
      value={line.quantity}
      min={0}
      max={max}
      maxReason={maxReason}
      tone="leaf"
      display="text"
      disabled={busy}
      onChange={change}
    />
  );
}

/** The card's action: *Add*, the stepper once it is in the basket, or *Alert me* (the stock alert lives on the product page). */
function CardAction({
  item,
  href,
  basketLine,
  maxPerLine,
  onMessage,
}: {
  item: CatalogueItem;
  href: string;
  /** This card's single basket line, when it has one. */
  basketLine: CartLine | null;
  maxPerLine: number;
  onMessage: (text: string, kind: 'ok' | 'problem') => void;
}) {
  const quickAdd = useQuickAdd(item, href, onMessage);
  if (basketLine) {
    return (
      <CardStepper item={item} line={basketLine} maxPerLine={maxPerLine} onMessage={onMessage} />
    );
  }
  if (item.availability === 'OutOfStock') {
    return (
      <Link
        href={`${href}#stock-alert`}
        aria-label={`Tell me when ${item.name} is back`}
        className={buttonVariants({ variant: 'pillSecondary', size: 'pillMd', className: 'px-4' })}
      >
        Alert me
      </Link>
    );
  }
  return (
    <Button
      variant="pill"
      size="pillMd"
      className="bg-warm px-5 font-bold text-ink hover:bg-warm-soft"
      aria-busy={quickAdd.busy || undefined}
      aria-label={
        quickAdd.chooseOnPage
          ? `Add ${cardTitle(item)}: choose options`
          : `Add ${cardTitle(item)} to basket`
      }
      onClick={() => void quickAdd.run()}
    >
      {quickAdd.busy ? 'Adding…' : 'Add'}
    </Button>
  );
}

/** Producer and country (G1: there is no district yet), in the leaf eyebrow. */
function Eyebrow({ item }: { item: CatalogueItem }) {
  const country = item.countryOfOrigin;
  const flag = country ? countryFlag(country.code) : null;
  return (
    <p className="m-0 flex items-center gap-1.5 text-xs font-semibold uppercase leading-tight tracking-[0.06em] text-leaf">
      {country &&
        (flag ? (
          // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: in-repo SVG flag
          <img src={flag} alt="" width={16} height={11} className="h-[11px] w-4 rounded-[2px]" />
        ) : (
          <Globe size={13} aria-hidden="true" />
        ))}
      <span>{[item.brand, country?.name].filter(Boolean).join(' · ')}</span>
    </p>
  );
}

/**
 * HO-SHP-002 §11.2 `ProductCard`, in the approved store design (HO-P3 §8.3): a square tinted or photo
 * area, a white badge, the 44px wishlist heart, the producer and country eyebrow, the name (the heading
 * link) with its size, rating, a Fraunces price (`fromPrice`, as sent) and a mango *Add* pill. Once this
 * size is in the basket a leaf quantity stepper takes the Add button's place (D-7). Everything the
 * shopper needs is text; names and brands are PLAIN TEXT. No "Organic" badge: the catalogue items do
 * not carry certifications yet (G8).
 */
export function ProductCard({ item, lang, headingLevel = 'h2' }: ProductCardProps) {
  const Heading = headingLevel;
  // A size card opens the product page with that size selected (`?sku=`).
  const href = productHref(item.slug, { sku: item.skuId ?? undefined, lang: lang || undefined });
  const { line: basketLine, inBasket, maxPerLine } = useBasketLine(item);
  const [note, setNote] = React.useState<{ text: string; kind: 'ok' | 'problem' } | null>(null);
  const tone = packToneForCategory(item.category);
  const bg = PACK_BG[tone];
  // Signed, API-relative file URLs (SHP row 2): resolved against the API base before use.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  // A photo that fails to load (expired link, rate limit) falls back to the pack drawing, not a broken image.
  // A freshly signed link (new filter, refetch) gets its own try.
  const resolvedUrl = resolveFileUrl(item.primaryImage?.url);
  const imageUrl = resolvedUrl === failedSrc ? null : resolvedUrl;
  const imageAlt = item.primaryImage?.altText || `${item.name} — photo coming soon`;
  const badges = [
    item.kind === 'Bundle' && (
      <span key="kit" className="inline-flex items-center gap-1.5 text-leaf-ink">
        <Package size={13} aria-hidden="true" />
        Kit
      </span>
    ),
  ].filter(Boolean);

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border-[1.5px] border-border bg-surface">
      {/* A photo (white-backed pack shots) sits on white; the drawn pack keeps its tinted tile (2026-10-16). */}
      <div
        className={cn(
          'relative grid aspect-square w-full place-items-center overflow-hidden',
          imageUrl ? 'border-b border-border bg-surface' : bg,
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: no next/image remote config
          <img
            src={imageUrl}
            alt={imageAlt}
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(imageUrl)}
            // Kept inside the square: a tall pack photo must not spill over the name below.
            className="absolute inset-0 size-full object-contain p-3"
          />
        ) : (
          <span role="img" aria-label={imageAlt} className="grid size-full place-items-center">
            <ProductPackArt tone={tone} className="size-3/5 rounded-none bg-transparent" />
          </span>
        )}
        {(badges.length > 0 || inBasket > 0) && (
          <div className="absolute left-3 top-3 flex max-w-[calc(100%-72px)] flex-col items-start gap-1.5">
            {badges.map((badge, i) => (
              <span
                key={i}
                className="rounded-pill bg-surface px-3 py-1.5 text-xs font-bold leading-tight"
              >
                {badge}
              </span>
            ))}
            {inBasket > 0 && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-leaf px-2.5 py-1 text-xs font-bold text-leaf-soft">
                <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                In basket
              </span>
            )}
          </div>
        )}
        <CardWishlistButton
          item={item}
          href={href}
          onProblem={(text) => setNote({ text, kind: 'problem' })}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-4 md:px-[18px] md:pb-5">
        <Eyebrow item={item} />
        <Heading className="m-0 text-base font-semibold leading-snug text-ink">
          <Link href={href} className="text-ink no-underline hover:text-accent hover:underline">
            <span className="line-clamp-2 min-h-[2.75em]">{item.name}</span>
            {item.sizeLabel && (
              // The size with the title (owner, 2026-10-18), on its own line so a long name can never
              // hide it; read as "<name> · 1 kg".
              <span className="mt-0.5 block font-medium text-ink-muted">
                <span className="sr-only"> · </span>
                {item.sizeLabel}
              </span>
            )}
          </Link>
        </Heading>
        <RatingText rating={item.rating} />
        {item.availability !== 'InStock' && <AvailabilityText availability={item.availability} />}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 pt-1.5">
          <p className="m-0 font-display text-xl font-bold leading-tight text-ink">
            {formatPriceRange(item.fromPrice, item.priceVaries)}
          </p>
          <CardAction
            item={item}
            href={href}
            basketLine={basketLine}
            maxPerLine={maxPerLine}
            onMessage={(text, kind) => setNote({ text, kind })}
          />
        </div>
        {/* A successful add or removal shows nothing on the card: the stepper and the "In basket" tag say
            it. It is still announced to screen readers; only problems are shown. */}
        <p
          role={note?.kind === 'problem' ? 'alert' : 'status'}
          className={cn(
            'm-0 text-sm font-semibold empty:hidden',
            note?.kind === 'problem' ? 'text-danger-ink' : 'sr-only',
          )}
        >
          {note?.text}
        </p>
      </div>
    </article>
  );
}
