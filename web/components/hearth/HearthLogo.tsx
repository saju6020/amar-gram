import Link from 'next/link';
import { cn } from '@/lib/utils';

/** A sprout with two leaves rising from a field line, in the leaf-soft tone on the banana-leaf badge (Amar Gram, 2026-10-23). */
function Sprout() {
  return (
    <svg width="68%" height="68%" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path
        d="M16 28V15"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path d="M16 17c0-5.5-3.6-9.4-10-9.6.2 6.4 4.1 9.8 10 9.6z" />
      <path d="M16 14c.3-5.6 3.9-9.3 10.2-9.3-.4 6.3-4.4 9.6-10.2 9.3z" />
      <path
        d="M6 28h20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M15 15.6L9.4 10.4M17 12.8l5.4-5"
        fill="none"
        stroke="var(--leaf)"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The shop's logo (Amar Gram pivot, 2026-10-23; replaces the PurrCare badge): a tilted banana-leaf badge
 * with the sprout, "Amar" in ink and "Gram" in leaf green (both in the display font), and a small "Shop" tag. Reads
 * "Amar Gram Shop".
 * Sized from the link's font size, so the header's `text-xl md:text-2xl` scales it.
 */
function SproutBadgeLogo({
  href,
  className,
  tagClassName,
  accentClassName = 'text-leaf',
}: {
  href: string;
  className?: string;
  tagClassName?: string;
  accentClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 whitespace-nowrap text-2xl text-ink no-underline',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-[1.65em] flex-none rotate-[-4deg] place-items-center rounded-[0.52em] bg-leaf text-leaf-soft"
      >
        <Sprout />
      </span>
      <span className="font-display text-[1.12em] font-bold leading-none tracking-[-0.02em]">
        Amar <span className={accentClassName}>Gram</span>
      </span>{' '}
      <span
        className={cn(
          'self-center rounded-pill bg-warm-soft px-2 py-1 font-sans text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] text-warm-ink',
          tagClassName,
        )}
      >
        Shop
      </span>
    </Link>
  );
}

export interface HearthLogoProps {
  /** Where the logo sits; it only sets the default link (the logo itself is the same everywhere). */
  variant?: 'shop' | 'portal';
  /** Defaults to `/shop` for the shop variant and `/` for the portal variant. */
  href?: string;
  className?: string;
  /** Override the "Shop" tag's fill, e.g. `bg-surface` where the logo sits on a warm-soft panel. */
  tagClassName?: string;
  /** The colour of "Gram"; `text-leaf` by default. On a leaf background use a light tone (leaf on leaf-ink is ~1.4:1). */
  accentClassName?: string;
}

/**
 * The Amar Gram logo. One logo everywhere (owner, 2026-10-19, kept through the 2026-10-23 rebrand): the shop's
 * badge with its "Shop" tag is used in the shop, sign-in pages, the customer account area and the staff area.
 */
export function HearthLogo({
  variant = 'shop',
  href,
  className,
  tagClassName,
  accentClassName,
}: HearthLogoProps) {
  return (
    <SproutBadgeLogo
      href={href ?? (variant === 'shop' ? '/shop' : '/')}
      className={className}
      tagClassName={tagClassName}
      accentClassName={accentClassName}
    />
  );
}
