import type { Metadata } from 'next';
import Link from 'next/link';
import { BannerStrip } from '@/components/shop/BannerStrip';
import { ShopHero } from '@/components/shop/ShopHero';
import { CategoryTiles } from '@/components/shop/home/CategoryTiles';
import { GrowersBand } from '@/components/shop/home/GrowersBand';
import { SeasonalCard } from '@/components/shop/home/SeasonalCard';
import { ProductGrid } from '@/components/catalogue/ProductGrid';
import { MaintenanceNotice } from '@/components/shop/MaintenanceNotice';
import { PromiseStrip } from '@/components/hearth/DeliveryPromise';
import {
  getBannersServer,
  getCatalogueServer,
  getCategoriesServer,
  getOriginsServer,
} from '@/lib/api/shop-catalogue';
import { EMPTY_CATALOGUE_PARAMS } from '@/lib/shop/catalogueParams';
import { isMaintenanceError, settle } from '@/lib/shop/helpers';

export const metadata: Metadata = {
  title: 'Amar Gram — organic food and everyday goods',
  description:
    'Shop organic rice, honey, spices, oils and everyday goods, each with its origin named.',
  alternates: { canonical: '/shop' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SECTION_HEADING =
  'm-0 font-display text-[clamp(1.75rem,3vw,2.125rem)] font-bold tracking-[-0.02em] text-ink';

/**
 * `/shop` — the storefront home to docs/design/store/Home.dc.html and HomePhone.dc.html (HO-P3 S1):
 * hero band, "Shop the pantry" category tiles, "Fresh from the haat" (the newest eight), the growers
 * band, then the promises. Below `md` the hero gives way to a seasonal card, the tiles become a
 * scrolling circle row, and only the first three blocks show. No staples-box band (G2). Server
 * Component; every block comes from a public endpoint and is omitted when its read fails or is empty.
 */
export default async function ShopHomePage({ searchParams }: { searchParams: SearchParams }) {
  const rawLang = (await searchParams).lang;
  const lang = typeof rawLang === 'string' ? rawLang : '';
  const [banners, categories, origins, arrivals] = await Promise.all([
    settle(getBannersServer('Home')),
    settle(getCategoriesServer()),
    settle(getOriginsServer()),
    settle(getCatalogueServer({ ...EMPTY_CATALOGUE_PARAMS, sort: 'newest', lang })),
  ]);
  for (const read of [categories, origins, arrivals]) {
    if (!read.ok && isMaintenanceError(read.error)) return <MaintenanceNotice />;
  }
  const featured = origins.ok ? origins.value.filter((o) => o.isFeatured) : [];
  const newest = arrivals.ok ? arrivals.value.items.slice(0, 8) : [];
  const [heroBanner, ...otherBanners] = banners.ok ? banners.value : [];

  return (
    <div className="flex min-w-0 flex-col gap-6 md:gap-16">
      <div className="flex flex-col gap-4">
        <ShopHero
          banner={heroBanner ?? null}
          featured={newest[0] ?? null}
          lang={lang || undefined}
        />
        <SeasonalCard banner={heroBanner ?? null} />
        {otherBanners.length > 0 && <BannerStrip banners={otherBanners} />}
      </div>

      {categories.ok && <CategoryTiles categories={categories.value} lang={lang || undefined} />}

      {newest.length > 0 && (
        <section aria-label="Fresh from the haat" className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-baseline justify-between gap-3">
            {/* The phone's heading is the page's h1 (HomePhone); from md the hero holds the h1. */}
            <h1 id="home-fresh" className={`${SECTION_HEADING} md:hidden`}>
              Fresh from the haat
            </h1>
            <h2 id="home-fresh-wide" className={`${SECTION_HEADING} hidden md:block`}>
              Fresh from the haat
            </h2>
            <Link
              href="/shop/products"
              className="text-sm font-semibold text-accent-ink md:text-base"
            >
              See all <span className="sr-only md:not-sr-only">products</span>
            </Link>
          </div>
          <ProductGrid items={newest} lang={lang || undefined} headingLevel="h3" wide />
        </section>
      )}

      <div className="hidden flex-col gap-12 md:flex">
        <GrowersBand origins={featured} lang={lang || undefined} />
        <PromiseStrip />
      </div>
    </div>
  );
}
