import type * as React from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { NoResults } from '@/components/catalogue/NoResults';
import { Pagination } from '@/components/catalogue/Pagination';
import { ProductGrid } from '@/components/catalogue/ProductGrid';
import { ResultSummary } from '@/components/catalogue/ResultSummary';
import { HearthBand } from '@/components/hearth/HearthBand';
import { MaintenanceNotice } from '@/components/shop/MaintenanceNotice';
import { ShopLoadError } from '@/components/shop/ShopLoadError';
import { ApiValidationError } from '@/lib/api/client';
import { SHOP_CODE_MESSAGES } from '@/lib/api/errors';
import {
  getCatalogueFiltersServer,
  getCatalogueServer,
  getCategoriesServer,
} from '@/lib/api/shop-catalogue';
import { isMaintenanceError, settle } from '@/lib/shop/helpers';
import {
  clearFilters,
  toQueryString,
  withoutFixed,
  type CatalogueParams,
} from '@/lib/shop/catalogueParams';
import { CatalogueControls } from './CatalogueControls';

export interface CatalogueViewProps {
  /** The shopper's URL state (`/shop/products?…` or an origin page's query). */
  params: CatalogueParams;
  /** The page's own path — links (pages, suggestions) are built on it. */
  basePath: string;
  /** Values the page owns (an origin page's country): applied to the API call, never in the URL. */
  fixed?: Partial<CatalogueParams>;
  /**
   * The page's `<h1>`. When given, the view draws the design's heading band (the title and the
   * result count) above the filters; without it the caller owns its own heading and the count sits
   * in the toolbar (an origin page).
   */
  bandTitle?: string;
}

/**
 * The heading band of `Catalogue.dc.html`: the h1 on the left, the result count on the right. The
 * count (`summary`) is a polite live region; it is absent while the results could not be read.
 */
function CatalogueBand({ title, summary }: { title: string; summary: React.ReactNode }) {
  return (
    <HearthBand
      as="header"
      className="flex flex-wrap items-end justify-between gap-4 px-6 py-6 md:px-8 md:py-7"
    >
      <h1 className="m-0 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
        {title}
      </h1>
      {summary}
    </HearthBand>
  );
}

/**
 * HO-SHP-002 §11.2 / §11.4 — the server-rendered catalogue: results, pagination and suggestions
 * come straight from `GET /api/shop/products` (ADR-FE-030/031/032), with real links. Only the
 * filter/sort controls are a client island. The UI never filters, sorts or counts anything itself.
 */
export async function CatalogueView({
  params,
  basePath,
  fixed = {},
  bandTitle,
}: CatalogueViewProps) {
  const effective: CatalogueParams = { ...params, ...fixed };
  // Links must not carry the page-owned values, and must keep everything else.
  const urlParams = withoutFixed(params, fixed);
  const retryHref = `${basePath}${toQueryString(urlParams)}`;
  const [result, facets, categories] = await Promise.all([
    settle(getCatalogueServer(effective)),
    settle(getCatalogueFiltersServer(effective.category || undefined)),
    settle(getCategoriesServer()),
  ]);
  // Even when the results cannot be shown, the page keeps its heading.
  const withBand = (body: React.ReactNode) =>
    bandTitle ? (
      <div className="flex flex-col gap-6">
        <CatalogueBand title={bandTitle} summary={null} />
        {body}
      </div>
    ) : (
      body
    );

  if (!result.ok) {
    if (isMaintenanceError(result.error)) return <MaintenanceNotice />;
    if (result.error instanceof ApiValidationError) {
      return withBand(
        <ErrorState
          title="That search or filter isn’t valid."
          description={
            SHOP_CODE_MESSAGES[result.error.response.errors[0]?.errorCode ?? ''] ??
            'Clear the filters and try again.'
          }
        />,
      );
    }
    return withBand(<ShopLoadError retryHref={retryHref} error={result.error} />);
  }
  if (!facets.ok) return withBand(<ShopLoadError retryHref={retryHref} error={facets.error} />);
  const href = (next: CatalogueParams) => `${basePath}${toQueryString(next)}`;
  const { items, totalCount, totalItemCount, pageNumber, pageSize, suggestions } = result.value;
  const currencyCode = items.find((i) => i.fromPrice)?.fromPrice?.currencyCode ?? 'BDT';
  // One card per size (owner, 2026-10-18): the count is of cards; paging below stays per product.
  const summary = (
    <ResultSummary totalCount={totalItemCount ?? totalCount} q={params.q} inBand={!!bandTitle} />
  );

  const controls = (
    <CatalogueControls
      facets={facets.value}
      categories={categories.ok ? categories.value : []}
      currencyCode={currencyCode}
      fixed={fixed}
      summary={bandTitle ? null : summary}
    >
      {items.length === 0 ? (
        <NoResults
          q={params.q}
          suggestions={suggestions}
          hrefForQuery={(q) => href({ ...urlParams, q, pageNumber: 1 })}
          clearHref={href(clearFilters(urlParams))}
          lang={params.lang || undefined}
        />
      ) : (
        <>
          <ProductGrid items={items} lang={params.lang || undefined} label="Products" wide />
          <Pagination
            pageNumber={pageNumber}
            pageSize={pageSize}
            totalCount={totalCount}
            hrefFor={(page) => href({ ...urlParams, pageNumber: page })}
          />
        </>
      )}
    </CatalogueControls>
  );
  if (!bandTitle) return controls;
  return (
    <div className="flex flex-col gap-6">
      <CatalogueBand title={bandTitle} summary={summary} />
      {controls}
    </div>
  );
}
