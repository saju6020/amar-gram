'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { categoryLabel } from '@/lib/shop/labels';
import type { CategoryNode } from '@/lib/api/shop-catalogue';
import { cn } from '@/lib/utils';

type ChipKey = 'all' | 'countries' | `category:${string}`;

const CHIP_CLASS =
  'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill border-[1.5px] px-4 text-[15px] font-medium no-underline';

/** The design's category pills: surface fill and a 1.5px border; the current one is the filled banana-leaf pill. */
export function CategoryChips({
  categories,
  current = null,
}: {
  categories: CategoryNode[];
  current?: ChipKey | null;
}) {
  const chips: { key: ChipKey; href: string; label: string }[] = [
    { key: 'all', href: '/shop/products', label: 'All products' },
    { key: 'countries', href: '/shop/countries', label: 'Shop by country' },
    ...categories.map((category) => ({
      key: `category:${category.value}` as ChipKey,
      href: `/shop/products?category=${encodeURIComponent(category.value)}`,
      label: categoryLabel(category.value),
    })),
  ];
  return (
    <>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-current={current === chip.key ? 'page' : undefined}
          className={cn(
            CHIP_CLASS,
            current === chip.key
              ? 'border-leaf bg-leaf text-leaf-soft'
              : 'border-border bg-surface text-ink hover:border-leaf',
          )}
        >
          {chip.label}
        </Link>
      ))}
    </>
  );
}

/** Reads the URL to mark the current chip. Suspended by the header, with `CategoryChips` as the fallback. */
export function CurrentCategoryChips({ categories }: { categories: CategoryNode[] }) {
  const pathname = usePathname();
  const category = useSearchParams().get('category');
  let current: ChipKey | null = null;
  if (pathname.startsWith('/shop/countries')) current = 'countries';
  else if (pathname === '/shop/products') current = category ? `category:${category}` : 'all';
  return <CategoryChips categories={categories} current={current} />;
}
