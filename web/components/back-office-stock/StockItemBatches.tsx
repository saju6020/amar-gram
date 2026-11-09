'use client';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { SkuStockMatrix } from '@/components/stock/SkuStockMatrix';
import { useSkuStockMatrix } from '@/lib/hooks/useInventory';

/**
 * `components/back-office-stock/StockItemBatches.tsx` — HO-P4 S4, 11.5.3. The batches of one item
 * (lot, expiry, state, quantity by location), fetched when this component first mounts — which the
 * stock list does only on the row's first expand. Reuses the existing `SkuStockMatrix`.
 */
export function StockItemBatches({ skuId }: { skuId: string }) {
  const query = useSkuStockMatrix(skuId);
  if (query.isLoading) return <LoadingState rows={2} label="Loading batches…" />;
  if (query.isError || !query.data) {
    return <ErrorState title="Batches could not be loaded" onRetry={() => void query.refetch()} />;
  }
  return <SkuStockMatrix matrix={query.data} />;
}
