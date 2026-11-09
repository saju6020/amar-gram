import Link from 'next/link';
import { FlagOrGlobe } from '@/components/shop/OriginGrid';
import type { Origin } from '@/lib/api/shop-catalogue';

const MAX_ORIGINS = 2;

/**
 * The leaf "growers" band (Home.dc.html). The heading and paragraph state only what the shop does
 * (it names the country of origin on our foods); the tiles are up to two featured origins from the
 * API (name, product count, link). No grower names or photos are invented (D-4); with no featured
 * origin the band is text only.
 */
export function GrowersBand({ origins, lang }: { origins: Origin[]; lang?: string }) {
  const shown = origins.slice(0, MAX_ORIGINS);
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  return (
    <section
      id="growers"
      aria-labelledby="home-growers"
      className="grid scroll-mt-24 items-start gap-8 rounded-band bg-leaf px-6 py-10 text-leaf-soft md:px-12 md:py-12 lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]"
    >
      <div className="flex flex-col gap-3.5">
        <h2
          id="home-growers"
          className="m-0 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.02em] text-leaf-soft"
        >
          Our products name their origin.
        </h2>
        <p className="m-0 text-leaf-soft">
          We name the country of origin on our foods, so you can shop by where they were grown.
        </p>
        <Link href={`/shop/countries${query}`} className="font-semibold text-leaf-soft underline">
          Read our sourcing story
        </Link>
      </div>
      {shown.map((origin) => (
        <Link
          key={origin.code}
          href={`/shop/countries/${origin.code}${query}`}
          className="flex flex-col gap-3 text-leaf-soft no-underline"
        >
          <span
            aria-hidden="true"
            className="grid aspect-[4/3] place-items-center rounded-card bg-leaf-ink"
          >
            <FlagOrGlobe code={origin.code} size={56} />
          </span>
          <strong className="text-[17px]">{origin.name}</strong>
          <span className="text-[15px]">
            {origin.productCount} {origin.productCount === 1 ? 'product' : 'products'}
          </span>
        </Link>
      ))}
    </section>
  );
}
