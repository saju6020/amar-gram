'use client';

import { Suspense } from 'react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { StockBrowser } from '@/components/back-office-stock/StockBrowser';
import { LoadingState } from '@/components/common/LoadingState';
import { InventoryOverview } from '@/components/inventory/InventoryOverview';
import { QueryBoundary } from '@/components/inventory/QueryBoundary';
import { useAlertSummary, useNearExpiryReport } from '@/lib/hooks/useInventory';
import { useRecalls } from '@/lib/hooks/useInventoryRecalls';

/** `/staff/inventory` — Inventory & batches: the attention rows (alerts, near-expiry, recalls) over
 *  "Stock by item" with expandable batches. A row whose data the server refuses (`403`) is left out;
 *  the alert summary is what gates the page itself. */
export default function InventoryOverviewPage() {
  const alerts = useAlertSummary();
  const nearExpiry = useNearExpiryReport({});
  const recalls = useRecalls({ status: 'Active', pageNumber: 1, pageSize: 1 });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventory & batches"
        actions={
          <>
            <ActionLink href="/staff/inventory/counts/new" variant="outline">Stock count</ActionLink>
            <ActionLink href="/staff/inventory/recalls" variant="danger-outline">Start a recall</ActionLink>
            <ActionLink href="/staff/inventory/receipts/new" variant="primary">Receive goods</ActionLink>
          </>
        }
      />
      <QueryBoundary query={alerts}>
        {(summary) => (
          <>
            <InventoryOverview alerts={summary} nearExpiry={nearExpiry.data} activeRecalls={recalls.data?.totalCount} />
            <Suspense fallback={<LoadingState rows={5} />}>
              <StockBrowser />
            </Suspense>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
