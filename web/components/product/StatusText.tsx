import { Check, Globe, Star, X } from 'lucide-react';
import { countryFlag, formatRating } from '@/lib/format/shop';
import { availabilityText } from '@/lib/shop/labels';
import { cn } from '@/lib/utils';
import type { Availability, CountryRef, RatingSummary } from '@/lib/api/shop-catalogue';

/** Availability: text plus an icon, never colour alone (UI-6). */
export function AvailabilityText({ availability }: { availability: Availability }) {
  const inStock = availability === 'InStock';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium',
        inStock ? 'text-leaf-ink' : 'text-danger-ink',
      )}
    >
      {inStock ? (
        <Check size={14} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <X size={14} strokeWidth={2.4} aria-hidden="true" />
      )}
      {availabilityText(availability)}
    </span>
  );
}

/** "4.5 out of 5 (23 reviews)" as text; the stars are decorative (`aria-hidden`). */
export function RatingText({ rating, compact = false }: { rating: RatingSummary; compact?: boolean }) {
  const average = rating.count > 0 ? (rating.average ?? 0) : 0;
  const full = formatRating(rating.average, rating.count);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-muted">
      <span aria-hidden="true" className="inline-flex text-warm-ink">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={13}
            fill={i < Math.round(average) ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        ))}
      </span>
      {compact && rating.count > 0 && average > 0 ? (
        // A product card's short form, "4.5 (23)", on one line; the full wording is what is read out.
        <>
          <span aria-hidden="true">
            {Number.isInteger(average) ? average : average.toFixed(1)}{' '}
            <span className="text-ink-muted/80">({rating.count})</span>
          </span>
          <span className="sr-only">{full}</span>
        </>
      ) : (
        <span>{full}</span>
      )}
    </span>
  );
}

/** Flag (decorative, `alt=""`) next to the country name, which is always shown as text. */
export function OriginText({ country }: { country: CountryRef }) {
  const flag = countryFlag(country.code);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: in-repo SVG flag
        <img src={flag} alt="" width={18} height={12} className="h-3 w-[18px] rounded-[2px]" />
      ) : (
        <Globe size={14} aria-hidden="true" />
      )}
      {country.name}
    </span>
  );
}
