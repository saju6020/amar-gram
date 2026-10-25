'use client';

import { Suspense } from 'react';
import { StockBrowser } from '@/components/back-office-stock/StockBrowser';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeading } from '@/components/inventory/fields';

/** `/staff/inventory/stock` — US-IMP-06/08: stock by item, with sellable kept apart from on hand. */
export default function StockPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Stock"
        description="Available excludes expired, quarantined, damaged and reserved stock. All figures are the server's."
      />
      <Suspense fallback={<LoadingState rows={5} />}>
        <StockBrowser />
      </Suspense>
    </div>
  );
}
