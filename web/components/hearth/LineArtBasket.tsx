import * as React from 'react';

/**
 * The Hearth harvest-basket line illustration (Amar Gram, 2026-10-23; replaces the sitting cat): a woven
 * basket with leaves and a grain stalk rising out of it. Stroke is `currentColor`, so the caller sets the
 * colour (warm-ink on a white disc). Decorative: hidden from assistive technology unless a `title` is passed.
 */
export function LineArtBasket({
  width = 190,
  height = 210,
  title,
  className,
}: {
  width?: number;
  height?: number;
  /** Only when the basket carries meaning; omit for decoration. */
  title?: string;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 132"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* grain stalk */}
      <path d="M60 70V14" />
      <path d="M60 22c-5-2-8-6-8-11 5 1 8 5 8 11zM60 22c5-2 8-6 8-11-5 1-8 5-8 11z" />
      <path d="M60 36c-5-2-8-6-8-11 5 1 8 5 8 11zM60 36c5-2 8-6 8-11-5 1-8 5-8 11z" />
      {/* leaves */}
      <path d="M50 70c-4-14-14-22-28-22 2 14 12 22 28 22z" />
      <path d="M70 70c4-14 14-22 28-22-2 14-12 22-28 22z" />
      <path d="M36 56l12 12M84 56L72 68" />
      {/* basket */}
      <path d="M18 72h84" />
      <path d="M22 72l8 44c1 5 4 8 9 8h42c5 0 8-3 9-8l8-44" />
      <path d="M26 88h68M29 104h62" />
      <path d="M44 72l3 52M60 72v52M76 72l-3 52" />
      {/* handle */}
      <path d="M30 72c0-30 60-30 60 0" opacity={0.55} />
    </svg>
  );
}
