import type { Metadata } from 'next';
import { EmptyWarmIllustration, EmptyState } from '@/components/common/EmptyState';
import { HearthBand } from '@/components/hearth/HearthBand';
import { ShopLoadError } from '@/components/shop/ShopLoadError';
import { MaintenanceNotice } from '@/components/shop/MaintenanceNotice';
import { OriginGrid } from '@/components/shop/OriginGrid';
import { getOriginsServer } from '@/lib/api/shop-catalogue';
import { isMaintenanceError, settle } from '@/lib/shop/helpers';

export const metadata: Metadata = {
  title: 'Shop by country of origin | Amar Gram',
  description: 'See where our products come from and shop by country.',
  alternates: { canonical: '/shop/countries' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/shop/countries` — HO-SHP-002 §11.4, US-SHP-05 AC1. */
export default async function CountriesPage({ searchParams }: { searchParams: SearchParams }) {
  const lang = (await searchParams).lang;
  const origins = await settle(getOriginsServer());
  if (!origins.ok) {
    if (isMaintenanceError(origins.error)) return <MaintenanceNotice />;
    return <ShopLoadError retryHref="/shop/countries" error={origins.error} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <HearthBand as="header" className="flex flex-col gap-3 md:p-10">
        <h1 className="m-0 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-ink">
          Shop by country
        </h1>
        <p className="m-0 max-w-prose text-base text-ink-muted">
          We name the country of origin on our foods. Pick a country to see its products.
        </p>
      </HearthBand>
      {origins.value.length === 0 ? (
        <EmptyState
          icon={<EmptyWarmIllustration />}
          title="No countries to show yet"
          description="We will list where our food comes from as soon as products are published."
        />
      ) : (
        <OriginGrid origins={origins.value} lang={typeof lang === 'string' ? lang : undefined} />
      )}
    </div>
  );
}
