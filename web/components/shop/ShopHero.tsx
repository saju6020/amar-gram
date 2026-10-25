import Link from 'next/link';
import { ArrowRight, Sprout } from 'lucide-react';
import { LimitedMarkup } from '@/components/content/LimitedMarkup';
import { HearthBand } from '@/components/hearth/HearthBand';
import { LineArtBasket } from '@/components/hearth/LineArtBasket';
import { buttonVariants } from '@/components/ui/button';
import { isSafeLink, plainExcerpt, productHref } from '@/lib/shop/helpers';
import type { CatalogueItem, StorefrontBanner } from '@/lib/api/shop-catalogue';

const H1_CLASS =
  'm-0 font-display text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-ink';

/** "{producer} · {country}" for the harvest card, from what the item carries; empty parts are skipped. */
function originLine(item: CatalogueItem): string {
  return [item.brand, item.countryOfOrigin?.name].filter(Boolean).join(' · ');
}

/**
 * The storefront home hero (docs/design/store/Home.dc.html), shown from `md`; the phone has the
 * seasonal card instead. With a `Home` banner, its title is the headline, its body the lead and its
 * link the main button. With none, the design's own headline and intro. The arched picture area is
 * the shop's illustration, never a fake photo. The "This week's harvest" card links to the newest
 * product, only when there is one.
 */
export function ShopHero({
  banner,
  featured,
  lang,
}: {
  banner: StorefrontBanner | null;
  featured: CatalogueItem | null;
  lang?: string;
}) {
  const bannerHeadline = banner ? plainExcerpt(banner.title, 120) : '';
  const bannerLink = banner && isSafeLink(banner.linkUrl) ? banner.linkUrl : null;
  const harvestOrigin = featured ? originLine(featured) : '';
  return (
    <HearthBand
      aria-labelledby="hero-title"
      className="hidden items-center gap-10 overflow-hidden px-6 py-10 md:grid md:px-10 md:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-12"
    >
      <div className="flex flex-col gap-5">
        {bannerHeadline ? (
          <h1 id="hero-title" className={H1_CLASS}>
            {bannerHeadline}
          </h1>
        ) : (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              From our village to your kitchen
            </p>
            <h1 id="hero-title" className={H1_CLASS}>
              Honest food,{' '}
              <em className="block font-medium italic text-leaf">grown the slow way.</em>
            </h1>
          </>
        )}
        {banner?.body ? (
          <LimitedMarkup
            body={banner.body}
            className="max-w-[460px] text-lg leading-relaxed text-ink-muted"
          />
        ) : (
          !bannerHeadline && (
            <p className="m-0 max-w-[460px] text-lg text-ink-muted">
              Rice, honey, oils and spices bought straight from the families who grow them, with the
              origin named on every product.
            </p>
          )
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            href={bannerLink ?? '/shop/products'}
            className={buttonVariants({ variant: 'pill', size: 'pillLg' })}
          >
            {bannerLink ? 'Find out more' : 'Shop the harvest'}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link
            href="#growers"
            className={buttonVariants({ variant: 'pillSecondary', size: 'pillLg' })}
          >
            Meet the growers
          </Link>
        </div>
      </div>
      <div className="relative hidden min-h-[360px] lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bottom-10 left-10 grid place-items-center rounded-t-[200px] rounded-b-3xl bg-surface text-warm-ink"
        >
          <LineArtBasket />
        </div>
        {featured && (
          <Link
            href={productHref(featured.slug, { lang })}
            className="absolute bottom-0 left-0 flex max-w-[300px] items-center gap-3.5 rounded-[20px] border-[1.5px] border-border bg-surface px-[18px] py-3.5 text-ink no-underline"
          >
            <span
              aria-hidden="true"
              className="grid size-12 flex-none place-items-center rounded-[14px] bg-warm text-ink"
            >
              <Sprout size={24} />
            </span>
            <span className="flex min-w-0 flex-col">
              <strong className="text-[15px]">This week&apos;s harvest</strong>
              <span className="truncate text-sm text-ink-muted">{featured.name}</span>
              {harvestOrigin && (
                <span className="truncate text-[13px] text-ink-muted">{harvestOrigin}</span>
              )}
            </span>
          </Link>
        )}
      </div>
    </HearthBand>
  );
}
