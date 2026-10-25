import Link from 'next/link';
import { PACK_BG, packToneForCategory } from '@/components/hearth/packTone';
import { categoryIcon } from '@/components/shop/categoryIcons';
import { categoryLabel } from '@/lib/shop/labels';
import { cn } from '@/lib/utils';
import type { CategoryNode } from '@/lib/api/shop-catalogue';

/**
 * "Shop the pantry" (Home.dc.html) and, below `md`, the phone's category circle row (HomePhone.dc.html).
 * One list serves both: a card grid from `md`, and a single row that scrolls inside its own `nav`
 * (never the page) on a phone. One tile per category the API sends, with its HO-P2 label and icon.
 */
export function CategoryTiles({ categories, lang }: { categories: CategoryNode[]; lang?: string }) {
  if (categories.length === 0) return null;
  return (
    <section aria-label="Shop the pantry" className="flex min-w-0 flex-col gap-5 md:gap-6">
      <h2 className="m-0 hidden font-display text-[clamp(1.75rem,3vw,2.125rem)] font-bold tracking-[-0.02em] text-ink md:block">
        Shop the pantry
      </h2>
      <nav aria-label="Categories" className="min-w-0">
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 md:grid md:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:gap-4 md:overflow-visible md:pb-0">
          {categories.map((category) => {
            const Icon = categoryIcon(category.value);
            const count = `${category.productCount} ${category.productCount === 1 ? 'product' : 'products'}`;
            return (
              <li key={category.value} className="w-[72px] flex-none md:w-auto">
                <Link
                  href={`/shop/products?category=${encodeURIComponent(category.value)}${lang ? `&lang=${encodeURIComponent(lang)}` : ''}`}
                  className="flex h-full flex-col items-center gap-1.5 text-center text-xs font-semibold text-ink no-underline md:gap-2.5 md:rounded-card md:border-[1.5px] md:border-border md:bg-surface md:px-2 md:py-[18px] md:text-[15px] md:hover:border-accent"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-14 flex-none place-items-center rounded-pill text-ink md:size-[72px]',
                      PACK_BG[packToneForCategory(category.value)],
                    )}
                  >
                    <Icon size={26} strokeWidth={1.8} />
                  </span>
                  <span>{categoryLabel(category.value)}</span>
                  <span className="hidden text-[13px] font-normal text-ink-muted md:block">
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}
