import type { ReactNode } from 'react';
import { cardClass } from '@/components/hearth/card';
import { cn } from '@/lib/utils';

/**
 * `components/checkout/CheckoutSection.tsx` — HO-P3 S3 (ADR-FE-175). One of the three numbered sections of the
 * single-page checkout (docs/design/store/Checkout.dc.html): a bordered card whose heading carries a leaf
 * number circle. The section is a labelled region named by its heading; the number is decoration (the
 * order of the page already carries it), so it stays out of the accessible name.
 */
export function CheckoutSection({
  id,
  step,
  title,
  children,
  className,
}: {
  /** Prefix for the heading's element id (`<id>-heading`). */
  id: string;
  step: 1 | 2 | 3;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(cardClass, 'flex min-w-0 scroll-mt-4 flex-col gap-3.5 sm:p-6', className)}
    >
      <h2 id={headingId} className="m-0 flex items-center gap-3 text-xl font-semibold text-ink">
        <span
          aria-hidden="true"
          className="grid size-8 flex-none place-items-center rounded-pill bg-leaf text-[15px] text-leaf-soft"
        >
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
