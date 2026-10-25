import type { Metadata } from 'next';
import Link from 'next/link';
import { categoryLabel, subcategoryLabel } from '@/lib/shop/labels';
import { parseCatalogueParams } from '@/lib/shop/catalogueParams';
import { CatalogueView } from '../../_components/CatalogueView';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = parseCatalogueParams(await searchParams);
  const title = params.q
    ? `Search results for “${params.q}” | Amar Gram`
    : params.category
      ? `${categoryLabel(params.category)} | Amar Gram`
      : 'Organic food and everyday goods | Amar Gram';
  return {
    title,
    description: 'Browse organic food and everyday goods. Filter by country of origin and brand.',
    alternates: { canonical: '/shop/products' },
  };
}

/**
 * `/shop/products` — HO-SHP-002 §3.2, US-SHP-04/06. A Server Component (NFR-PRF-1, ADR-FE-030): all
 * state is in the URL (ADR-FE-031); the page reads it through the one parser and the server returns
 * the filtered, sorted, paged results.
 */
export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseCatalogueParams(await searchParams);
  // The title follows what is shown (2026-10-16): "Food · Wet", or a single chosen brand.
  const heading = params.q
    ? `Results for “${params.q}”`
    : params.category
      ? params.subcategory
        ? `${categoryLabel(params.category)} · ${subcategoryLabel(params.subcategory)}`
        : categoryLabel(params.category)
      : params.brand.length === 1
        ? params.brand[0]!
        : 'All products';
  const crumbLink = 'text-accent-ink underline-offset-2 hover:underline';
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-ink-muted">
        <Link href="/shop" className={crumbLink}>
          Home
        </Link>
        <span aria-hidden="true">/</span>
        {params.category && params.subcategory ? (
          <>
            <Link
              href={`/shop/products?category=${encodeURIComponent(params.category)}`}
              className={crumbLink}
            >
              {categoryLabel(params.category)}
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{subcategoryLabel(params.subcategory)}</span>
          </>
        ) : params.category ? (
          <span aria-current="page">{categoryLabel(params.category)}</span>
        ) : (
          <span aria-current="page">All products</span>
        )}
      </nav>
      {/* The heading band (h1 and the result count) is drawn by CatalogueView, which owns the count. */}
      <CatalogueView params={params} basePath="/shop/products" bandTitle={heading} />
    </div>
  );
}
