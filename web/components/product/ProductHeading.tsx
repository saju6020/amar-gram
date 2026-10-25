import Link from 'next/link';
import { plainExcerpt } from '@/lib/shop/helpers';
import { RatingText } from './StatusText';
import type { CountryRef, RatingSummary } from '@/lib/api/shop-catalogue';

export interface ProductHeadingProps {
  name: string;
  /** Language the name was served in (`fieldLocales.name`) — WCAG 3.1.2. */
  nameLang: string;
  brand: string;
  rating: RatingSummary;
  country: CountryRef | null;
  lang?: string;
  /** The product's description (limited markup). Only a short plain excerpt of it is shown. */
  description?: string | null;
  /** Language the description was served in (`fieldLocales.description`). */
  descriptionLang?: string;
}

/**
 * HO-SHP-002 §11.3 `ProductHeading` in the approved design (HO-P3 S2): the "{producer} · {country}"
 * eyebrow in leaf (G1: there is no district or village yet), the Fraunces name (`<h1>`), a short
 * plain excerpt of the description, and the rating text. The country is the link to its origin page.
 */
export function ProductHeading({
  name,
  nameLang,
  brand,
  rating,
  country,
  lang,
  description,
  descriptionLang,
}: ProductHeadingProps) {
  const excerpt = plainExcerpt(description, 200);
  return (
    <header className="flex flex-col gap-3">
      <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">
        {brand}
        {country && (
          <>
            {' · '}
            <Link
              href={`/shop/countries/${country.code}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`}
              className="inline-flex min-h-8 items-center text-leaf no-underline hover:underline"
            >
              {country.name}
            </Link>
          </>
        )}
      </p>
      <h1
        lang={nameLang}
        className="m-0 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink"
      >
        {name}
      </h1>
      {excerpt && (
        <p lang={descriptionLang} className="m-0 text-[17px] leading-relaxed text-ink-muted">
          {excerpt}
        </p>
      )}
      <a
        href="#reviews"
        className="inline-flex min-h-8 items-center self-start text-ink-muted no-underline hover:underline"
      >
        <RatingText rating={rating} />
      </a>
    </header>
  );
}
