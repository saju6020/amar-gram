'use client';

import { RecommendationBlocks } from '@/components/recommendations/RecommendationBlocks';
import { OftenBoughtTogether } from '@/components/recommendations/OftenBoughtTogether';
import { LoadingState } from '@/components/common/LoadingState';
import { useRecommendations } from '@/lib/hooks/useShopCatalogue';

/** Fetched client side so the server's exclusions reflect the session (US-SHP-08). "Goes well with"
 *  is the server's frequently-bought-together list; "You might also like" is the up-sell list. A
 *  failure, or an empty list, just omits the blocks — recommendations never block the product page. */
export function ProductRecommendations({ slug, lang }: { slug: string; lang: string }) {
  const { data, isPending } = useRecommendations(slug, lang);
  if (isPending) return <LoadingState rows={2} label="Loading suggestions…" />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-10">
      <OftenBoughtTogether items={data.frequentlyBoughtTogether} lang={lang || undefined} />
      <RecommendationBlocks recommendations={data} lang={lang || undefined} hideFrequentlyBought />
    </div>
  );
}
