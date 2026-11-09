'use client';

import * as React from 'react';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { LoadingState } from '@/components/common/LoadingState';
import { AdjustmentForm } from '@/components/inventory/AdjustmentForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiForbiddenError } from '@/lib/api/client';
import type { StockSummary } from '@/lib/api/inventory-stock';
import { useRequestAdjustment } from '@/lib/hooks/useInventory';
import { useBarcodeLookup, useLocations, useSkuSearch } from '@/lib/hooks/useInventoryLookup';

/**
 * `components/back-office-stock/AdjustStockDialog.tsx` — HO-P4 S4, 11.5.4, US-IMP-13. "Adjust" on a
 * stock row opens the existing `AdjustmentForm` in a dialog with that item already on its first
 * line. Nothing about the form changes: the reason is still required, the note is required, the
 * confirm still states that the change cannot be undone, and whether a second person must approve
 * is the SERVER's answer, shown only once it is given. Mounted only while open, so its queries
 * (locations, the item's lookup row) do not run for a closed dialog.
 */
export function AdjustStockDialog({
  row,
  onClose,
  returnFocusRef,
}: {
  row: StockSummary;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const locations = useLocations();
  const lookup = useBarcodeLookup();
  const request = useRequestAdjustment();
  const search = useSkuSearch(row.skuCode);
  const sku = search.data?.find((s) => s.skuId === row.skuId);
  const forbidden = locations.error instanceof ApiForbiddenError;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        returnFocusRef={returnFocusRef}
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Adjust stock · {row.displayName}</DialogTitle>
          <DialogDescription>
            {row.skuCode} · counted in {row.stockUnit}. A reason and a note are required; the server decides whether
            it needs a second person&apos;s approval.
          </DialogDescription>
        </DialogHeader>
        {forbidden ? (
          <AccessRefusedState error={locations.error as ApiForbiddenError} />
        ) : locations.isLoading || search.isLoading ? (
          <LoadingState rows={3} label="Loading the adjustment form…" />
        ) : !sku ? (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            This item could not be loaded for an adjustment. Close this and try again, or use New adjustment.
          </p>
        ) : (
          <AdjustmentForm
            initialSku={sku}
            locations={locations.data}
            onScan={lookup}
            isPending={request.isPending}
            onRequest={(body) => request.mutateAsync(body)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
